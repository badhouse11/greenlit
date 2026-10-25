/**
 * The room: one game night. Holds the true game, runs the live auction and the
 * pitch clock, checks who is allowed to do what, and hands every device only
 * what it is allowed to see. Pure logic: the Cloudflare wrapper feeds it messages
 * and the time, and stores what it returns.
 */
import type { Game, Settings, TradeSide } from '../game/types';
import {
  RULES,
  RuleError,
  bin,
  cardTotal,
  castingComplete,
  commissioner,
  createGame,
  draw,
  editWinningFilm,
  eligibleBidders,
  executeTrade,
  fireCommissioner,
  foldStudio,
  legendsLeft,
  lockScores,
  maxBid,
  nextPitch,
  nextReel,
  sell,
  setPhase,
  setScore,
  setTitle,
  settleTie,
  slotsLeft,
  studioById,
  validateTrade,
} from '../game/engine';
import { PALETTE_KEYS } from '../lib/palette';
import type { Action, Auction, ClientMsg, Clock, Dealer, LobbyStudio, Offer, OscarStage, PitchNotes, Role, RoomEvent, View } from './protocol';
import { AUCTION, PREP_MS, emptyNotes } from './protocol';

export interface Seat {
  role: 'screen' | 'player';
  studioId: string | null;
}

export interface Meta {
  token: string | null;
  role: Role;
  studioId: string | null;
}

export interface RoomState {
  code: string;
  createdAt: number;
  seats: Record<string, Seat>; // token -> seat
  lobby: LobbyStudio[];
  game: Game | null;
  auction: Auction | null;
  clock: Clock;
  prep?: Clock;
  dealer?: Dealer;
  notes?: Record<string, PitchNotes>; // private to each studio
  oscar: { stage: OscarStage; at: number };
  offers: Offer[];
  lastSeen: Record<string, number>;
  history: { game: Game; label: string }[];
  event: RoomEvent | null;
  eventSeq: number;
  hostToken: string | null; // the phone that started the room runs the housekeeping
  shopUrl?: string;
}

export interface Outcome {
  /** Message for the sender only. */
  reply?: { t: 'welcome'; token: string | null; role: Role; studioId: string | null } | { t: 'error'; message: string };
  /** The sender's identity changed (joined, took over, became the screen). */
  meta?: Meta;
  /** Something everyone should see changed. */
  changed: boolean;
}

const PITCH_MS = RULES.pitchSeconds * 1000;
const HISTORY_MAX = 10;
const MAX_TITLE = 60;
const MAX_LOGLINE = 160;
const NOTE_LIMITS: Record<Exclude<keyof PitchNotes, 'roles'>, number> = { oneLiner: 200, start: 400, middle: 400, end: 400, bigMoment: 300 };
const MAX_ROLE = 120;
const FAR = 8.64e15; // a paused lot's clock is parked out of reach

const clone = <T>(v: T): T => structuredClone(v);
const token = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);

class Denied extends Error {}

export function newRoom(code: string, now: number): RoomState {
  return {
    code,
    createdAt: now,
    seats: {},
    lobby: [],
    game: null,
    auction: null,
    clock: { remainingMs: PITCH_MS, runningSince: null },
    prep: { remainingMs: PREP_MS, runningSince: null },
    dealer: { paused: false, nextAt: null },
    notes: {},
    oscar: { stage: 'table', at: 0 },
    offers: [],
    lastSeen: {},
    history: [],
    event: null,
    eventSeq: 0,
    hostToken: null,
  };
}

export class RoomCore {
  constructor(public state: RoomState) {
    // Rooms saved before these existed.
    state.prep ??= { remainingMs: PREP_MS, runningSince: null };
    state.dealer ??= { paused: false, nextAt: null };
    state.notes ??= {};
  }

  private get dealer(): Dealer {
    return this.state.dealer!;
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */
  private get g(): Game {
    if (!this.state.game) throw new Denied('The game hasn’t started yet.');
    return this.state.game;
  }

  private say(text: string, tone?: RoomEvent['tone']) {
    this.state.eventSeq += 1;
    this.state.event = { id: this.state.eventSeq, text, tone };
  }

  private name(id: string) {
    return studioById(this.g, id).name;
  }

  private isCommissioner(m: Meta) {
    return m.role === 'player' && !!this.state.game && m.studioId === this.state.game.round.commissionerId;
  }

  private online = new Set<string>();
  private now = 0;

  private hostStudio(): string | null {
    const t = this.state.hostToken;
    return t ? this.state.seats[t]?.studioId ?? null : null;
  }

  private isHost(m: Meta) {
    return !!m.token && m.token === this.state.hostToken;
  }

  /** The host's phone has been gone long enough for someone else to step in. */
  private hostAway() {
    const t = this.state.hostToken;
    if (!t || !this.state.seats[t]) return true;
    const id = this.state.seats[t].studioId;
    if (!id) return !this.online.size;
    if (this.online.has(id)) return false;
    return this.now - (this.state.lastSeen[id] ?? 0) >= AUCTION.hostAwayMs;
  }

  /** Host-only housekeeping. If the host has vanished, any studio can step in. */
  private requireHost(m: Meta) {
    if (this.isHost(m)) return;
    if (m.role === 'player' && m.studioId && m.token && this.hostAway()) {
      this.state.hostToken = m.token;
      const name = this.state.game?.studios.find((s) => s.id === m.studioId)?.name ?? this.state.lobby.find((l) => l.id === m.studioId)?.name;
      if (name) this.say(`${name} steps in as host.`);
      return;
    }
    throw new Denied('Only the host can do that.');
  }

  /** Public controls belong to the Commissioner; the host covers if the Commissioner's phone is away. */
  private requireRunner(m: Meta) {
    if (this.isCommissioner(m)) return;
    const commId = this.state.game?.round.commissionerId;
    if (commId && !this.online.has(commId) && this.isHost(m)) return;
    throw new Denied('That’s the Commissioner’s call.');
  }

  private requireCommissioner(m: Meta) {
    if (!this.isCommissioner(m)) throw new Denied('Only the Commissioner can do that.');
  }

  private requirePhase(...phases: Game['phase'][]) {
    if (!phases.includes(this.g.phase)) throw new Denied('Not at this stage of the reel.');
  }

  private snapshot(label: string) {
    this.state.history.push({ game: clone(this.g), label });
    if (this.state.history.length > HISTORY_MAX) this.state.history.shift();
  }

  private setGame(next: Game) {
    this.state.game = next;
  }

  /* ------------------------------------------------------------------ */
  /*  Entry point                                                        */
  /* ------------------------------------------------------------------ */
  handle(meta: Meta, msg: ClientMsg, now: number, online: Set<string>): Outcome {
    this.online = online;
    this.now = now;
    try {
      switch (msg.t) {
        case 'hello':
          return this.hello(meta, msg.token ?? null, !!msg.create);
        case 'join':
          return this.join(meta, msg.name, msg.colour);
        case 'takeover':
          return this.takeover(meta, msg.studioId, online, now);
        case 'watch':
          return this.watch(meta);
        case 'start':
          return this.start(meta, msg.settings);
        case 'act':
          return this.act(meta, msg.action, now, online);
        default:
          return { changed: false };
      }
    } catch (e) {
      if (e instanceof Denied || e instanceof RuleError) return { changed: false, reply: { t: 'error', message: e.message } };
      throw e;
    }
  }

  private hello(_meta: Meta, tok: string | null, create: boolean): Outcome {
    const seat = tok ? this.state.seats[tok] : undefined;
    if (seat) {
      return {
        changed: true,
        meta: { token: tok, role: seat.role, studioId: seat.studioId },
        reply: { t: 'welcome', token: tok, role: seat.role, studioId: seat.studioId },
      };
    }
    const exists = Object.keys(this.state.seats).length > 0;
    if (create) {
      if (exists) throw new Denied('That room code is taken.');
      // The phone that starts the room is a player and the host.
      const t = token();
      this.state.seats[t] = { role: 'player', studioId: null };
      this.state.hostToken = t;
      return { changed: true, meta: { token: t, role: 'player', studioId: null }, reply: { t: 'welcome', token: t, role: 'player', studioId: null } };
    }
    if (!exists) throw new Denied('No game with that code. Check the code with whoever started the game.');
    return { changed: false, meta: { token: null, role: 'guest', studioId: null }, reply: { t: 'welcome', token: null, role: 'guest', studioId: null } };
  }

  private join(meta: Meta, rawName: string, colour: string): Outcome {
    if (this.state.game) throw new Denied('This game has already started. Take over a studio instead.');
    if (meta.role === 'screen') throw new Denied('A big screen can’t join as a studio.');
    const name = rawName.trim().slice(0, 28);
    if (!name) throw new Denied('Give your studio a name.');
    const existing = meta.studioId ? this.state.lobby.find((l) => l.id === meta.studioId) : undefined;
    if (this.state.lobby.some((l) => l.name.toLowerCase() === name.toLowerCase() && l.id !== existing?.id)) {
      throw new Denied('Another studio already has that name.');
    }
    const taken = new Set(this.state.lobby.filter((l) => l.id !== existing?.id).map((l) => l.colour));
    const pick = PALETTE_KEYS.includes(colour) && !taken.has(colour) ? colour : PALETTE_KEYS.find((k) => !taken.has(k)) ?? PALETTE_KEYS[0];
    if (existing) {
      existing.name = name;
      existing.colour = pick;
      return { changed: true };
    }
    if (this.state.lobby.length >= RULES.maxStudios) throw new Denied(`The room is full: ${RULES.maxStudios} studios maximum.`);
    const id = `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.state.lobby.push({ id, name, colour: pick });
    const t = meta.token && this.state.seats[meta.token] ? meta.token : token();
    this.state.seats[t] = { role: 'player', studioId: id };
    this.say(`${name} has opened its doors.`);
    return { changed: true, meta: { token: t, role: 'player', studioId: id }, reply: { t: 'welcome', token: t, role: 'player', studioId: id } };
  }

  private takeover(meta: Meta, studioId: string, online: Set<string>, now: number): Outcome {
    if (meta.role === 'screen') throw new Denied('A big screen can’t run a studio.');
    const inLobby = !this.state.game && this.state.lobby.find((l) => l.id === studioId);
    const studio = this.state.game?.studios.find((s) => s.id === studioId);
    if (!inLobby && (!studio || studio.folded)) throw new Denied('That studio isn’t available.');
    if (online.has(studioId)) throw new Denied('That studio is still connected on another phone.');
    const t = token();
    for (const [old, s] of Object.entries(this.state.seats)) {
      if (s.studioId !== studioId) continue;
      if (old === this.state.hostToken) this.state.hostToken = t;
      delete this.state.seats[old];
    }
    this.state.seats[t] = { role: 'player', studioId };
    this.state.lastSeen[studioId] = now;
    const name = inLobby ? inLobby.name : studio!.name;
    this.say(`${name} is under new management.`);
    return { changed: true, meta: { token: t, role: 'player', studioId }, reply: { t: 'welcome', token: t, role: 'player', studioId } };
  }

  /** A laptop or TV that just shows the game. As many as you like. */
  private watch(meta: Meta): Outcome {
    if (meta.role === 'player') throw new Denied('This phone is already running a studio.');
    const t = token();
    this.state.seats[t] = { role: 'screen', studioId: null };
    return { changed: true, meta: { token: t, role: 'screen', studioId: null }, reply: { t: 'welcome', token: t, role: 'screen', studioId: null } };
  }

  private start(meta: Meta, settings: Settings): Outcome {
    this.requireHost(meta);
    if (this.state.game) throw new Denied('The game is already running.');
    const lobby = this.state.lobby;
    if (lobby.length < RULES.minStudios) throw new Denied(`You need at least ${RULES.minStudios} studios. ${lobby.length} so far.`);
    const game = createGame(
      lobby.map((l) => ({ name: l.name, colour: l.colour })),
      { directorsCut: !!settings?.directorsCut },
    );
    // Lobby ids become game ids (s1, s2...) in the same order.
    const map = new Map(lobby.map((l, i) => [l.id, game.studios[i].id]));
    for (const seat of Object.values(this.state.seats)) if (seat.studioId) seat.studioId = map.get(seat.studioId) ?? null;
    const seen: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.state.lastSeen)) seen[map.get(k) ?? k] = v;
    this.state.lastSeen = seen;
    this.state.game = game;
    this.state.history = [];
    this.resetReelExtras();
    this.say(`Roll camera. ${commissioner(game).name} commissions the first picture.`);
    return { changed: true };
  }

  private resetReelExtras() {
    this.state.auction = null;
    this.state.offers = [];
    this.state.clock = { remainingMs: PITCH_MS, runningSince: null };
    this.state.prep = { remainingMs: PREP_MS, runningSince: null };
    this.state.dealer = { paused: false, nextAt: null };
    this.state.notes = {};
    this.state.oscar = { stage: 'table', at: 0 };
  }

  /* ------------------------------------------------------------------ */
  /*  Game actions                                                       */
  /* ------------------------------------------------------------------ */
  private act(m: Meta, action: Action, now: number, online: Set<string>): Outcome {
    if (!this.state.game && action.a === 'fold') {
      this.requireHost(m);
      const entry = this.state.lobby.find((l) => l.id === action.studioId);
      if (!entry) throw new Denied('That studio has already left.');
      this.state.lobby = this.state.lobby.filter((l) => l.id !== entry.id);
      for (const [t, seat] of Object.entries(this.state.seats)) if (seat.studioId === entry.id) delete this.state.seats[t];
      this.say(`${entry.name} has left the building.`);
      return { changed: true };
    }
    if (action.a === 'backToLobby') {
      this.requireHost(m);
      if (this.state.game && this.state.game.phase !== 'final') throw new Denied('Finish the game first.');
      this.backToLobby();
      return { changed: true };
    }
    const g = this.g;
    switch (action.a) {
      case 'toCommission':
        this.requireRunner(m);
        this.requirePhase('handover');
        this.setGame(setPhase(g, 'commission'));
        break;

      case 'toCasting':
        this.requireRunner(m);
        this.requirePhase('commission');
        this.setGame(setPhase(g, 'casting'));
        this.state.dealer = { paused: false, nextAt: now + AUCTION.firstDealMs };
        break;

      case 'draw':
        // Deal the next star now, without waiting for the dealer.
        this.requireRunner(m);
        this.requirePhase('casting');
        if (this.state.auction) throw new Denied('There’s already a star under the hammer.');
        this.deal(now);
        break;

      case 'bid':
        this.bid(m, action.amount, now);
        break;

      case 'pass':
        this.pass(m, now);
        break;

      case 'dealPause': {
        this.requireRunner(m);
        this.requirePhase('casting');
        this.dealer.paused = true;
        const a = this.state.auction;
        if (a && a.pausedLeft == null) {
          a.pausedLeft = Math.max(0, a.endsAt - now);
          a.endsAt = FAR;
        }
        this.say('Cut! The auction is paused.');
        break;
      }

      case 'dealResume': {
        this.requireRunner(m);
        this.requirePhase('casting');
        this.dealer.paused = false;
        const a = this.state.auction;
        if (a && a.pausedLeft != null) {
          a.endsAt = now + Math.max(a.pausedLeft, 5000);
          a.pausedLeft = null;
        } else if (!a) {
          this.dealer.nextAt = now + 1500;
        }
        this.say('Action! The auction is back on.');
        break;
      }

      case 'hammer':
        this.requireRunner(m);
        this.resolveAuction(now);
        break;

      case 'bin':
        this.requireRunner(m);
        if (!this.state.auction) throw new Denied('Nobody is on the table.');
        if (this.state.auction.high) throw new Denied('There’s a bid on the table. Hammer it instead.');
        this.resolveAuction(now);
        break;

      case 'openEnvelope':
        this.requireRunner(m);
        this.requirePhase('casting');
        if (!castingComplete(g)) throw new Denied('Every studio needs five stars first.');
        this.setGame(setPhase(g, 'reveal'));
        break;

      case 'toTrading':
        this.requireRunner(m);
        this.requirePhase('reveal');
        this.setGame(setPhase(g, 'trading'));
        break;

      case 'offer':
        this.offer(m, action.to, action.fromGives, action.toGives);
        break;

      case 'acceptOffer': {
        this.requirePhase('trading');
        const o = this.state.offers.find((x) => x.id === action.id);
        if (!o) throw new Denied('That offer has been withdrawn.');
        if (m.role !== 'player' || m.studioId !== o.to) throw new Denied('That offer isn’t addressed to you.');
        this.snapshot('trade');
        this.setGame(executeTrade(g, { a: o.from, b: o.to, aGives: o.fromGives, bGives: o.toGives }));
        this.state.offers = this.state.offers.filter((x) => ![x.from, x.to].some((id) => id === o.from || id === o.to));
        this.say(`Deal done. ${this.name(o.from)} and ${this.name(o.to)} shake on it.`, 'sold');
        break;
      }

      case 'declineOffer': {
        const o = this.state.offers.find((x) => x.id === action.id);
        if (!o) return { changed: false };
        if (m.studioId !== o.to) throw new Denied('That offer isn’t addressed to you.');
        this.state.offers = this.state.offers.filter((x) => x.id !== o.id);
        this.say(`${this.name(o.to)} turns down ${this.name(o.from)}.`);
        break;
      }

      case 'cancelOffer':
        this.state.offers = this.state.offers.filter((x) => x.from !== m.studioId);
        break;

      case 'closeTrading':
        this.requireRunner(m);
        this.requirePhase('trading');
        this.state.offers = [];
        this.setGame(setPhase(g, 'prep'));
        this.state.prep = { remainingMs: PREP_MS, runningSince: now };
        break;

      case 'prepPause':
      case 'prepResume': {
        this.requireRunner(m);
        this.requirePhase('prep');
        const c = this.state.prep!;
        if (action.a === 'prepPause' && c.runningSince) {
          this.state.prep = { remainingMs: Math.max(0, c.remainingMs - (now - c.runningSince)), runningSince: null };
        } else if (action.a === 'prepResume' && !c.runningSince && c.remainingMs > 0) {
          c.runningSince = now;
        }
        break;
      }

      case 'firstPitch': {
        this.requireRunner(m);
        this.requirePhase('prep');
        this.setGame(setPhase(g, 'pitching'));
        this.state.clock = { remainingMs: PITCH_MS, runningSince: null };
        const pc = this.state.prep!;
        this.state.prep = { remainingMs: Math.max(0, pc.remainingMs - (pc.runningSince ? now - pc.runningSince : 0)), runningSince: null };
        break;
      }

      case 'clockStart':
      case 'clockPause':
      case 'clockReset':
      case 'nextPitch': {
        this.requirePhase('pitching');
        const onStage = g.round.pitchOrder[g.round.pitchCursor];
        if (!(this.isCommissioner(m) || m.studioId === onStage || this.isHost(m))) throw new Denied('It’s not your pitch.');
        this.clockAction(action.a, now);
        break;
      }

      case 'title': {
        this.requirePhase('prep', 'pitching', 'scoring');
        if (m.role !== 'player' || !m.studioId || !g.round.studios[m.studioId]) throw new Denied('Only a pitching studio can title a film.');
        this.setGame(setTitle(g, m.studioId, String(action.title ?? '').slice(0, MAX_TITLE)));
        return { changed: true };
      }

      case 'notes': {
        this.requirePhase('prep', 'pitching', 'scoring');
        if (m.role !== 'player' || !m.studioId || !g.round.studios[m.studioId]) throw new Denied('Only a pitching studio keeps notes.');
        this.saveNotes(m.studioId, action.notes);
        return { changed: true };
      }

      case 'score':
        this.requireCommissioner(m);
        this.requirePhase('scoring');
        this.setGame(setScore(g, action.studioId, action.cat, Number(action.value)));
        break;

      case 'seal':
        this.requireCommissioner(m);
        this.requirePhase('scoring');
        if (!Object.values(g.round.scores).some((c) => cardTotal(c) > 0)) throw new Denied('Punch at least one stamp first.');
        this.snapshot('seal');
        {
          let next = lockScores(g, action.vote);
          // The winner's one-liner goes on its ticket in the archive.
          const line = next.round.winnerId ? this.state.notes?.[next.round.winnerId]?.oneLiner.trim() : '';
          if (line) next = editWinningFilm(next, { logline: line.slice(0, MAX_LOGLINE) });
          this.setGame(next);
        }
        this.state.oscar = { stage: 'table', at: 0 };
        break;

      case 'oscarOpen':
        this.requireRunner(m);
        this.requirePhase('oscar');
        if (this.state.oscar.stage !== 'table') return { changed: false };
        this.state.oscar = { stage: 'drumroll', at: now + AUCTION.oscarDrumrollMs };
        break;

      case 'toCeremony':
        this.requireRunner(m);
        this.requirePhase('oscar');
        if (this.state.oscar.stage !== 'winner') throw new Denied('Open the envelope first.');
        this.setGame(setPhase(g, 'ceremony'));
        break;

      case 'logline': {
        this.requirePhase('ceremony');
        if (m.studioId !== g.round.winnerId) throw new Denied('Only the greenlit studio can write the logline.');
        this.setGame(editWinningFilm(g, { logline: String(action.text ?? '').slice(0, MAX_LOGLINE) }));
        return { changed: true };
      }

      case 'nextReel':
        this.requireRunner(m);
        this.requirePhase('ceremony');
        this.snapshot('next reel');
        this.setGame(nextReel(g));
        this.resetReelExtras();
        if (this.state.game!.phase !== 'final') this.say(`Reel ${this.state.game!.round.number}. ${commissioner(this.state.game!).name} takes the chair.`);
        break;

      case 'tieBreak':
        this.requireHost(m);
        this.requirePhase('final');
        this.setGame(settleTie(g, action.studioId));
        break;

      case 'fold': {
        this.requireHost(m);
        this.requireOfflineLongEnough(action.studioId, online, now);
        this.snapshot('fold');
        const name = this.name(action.studioId);
        this.setGame(foldStudio(g, action.studioId));
        this.state.offers = this.state.offers.filter((o) => o.from !== action.studioId && o.to !== action.studioId);
        this.say(
          this.state.game!.phase === 'final'
            ? `${name} has folded. Not enough studios left: roll the credits.`
            : g.phase === 'casting'
              ? `${name} has folded. Fire sale: their stars go back under the hammer.`
              : `${name} has folded.`,
          'alarm',
        );
        this.afterExit();
        break;
      }

      case 'fireCommissioner': {
        this.requireHost(m);
        const oldId = g.round.commissionerId;
        this.requireOfflineLongEnough(oldId, online, now);
        this.snapshot('fire');
        const next = fireCommissioner(g);
        this.setGame(next);
        this.say(
          next.phase === 'final'
            ? 'The Commissioner has walked, and there aren’t enough studios left. Roll the credits.'
            : `The Commissioner has been fired. The board appoints ${commissioner(next).name}.`,
          'alarm',
        );
        this.afterExit();
        break;
      }

      case 'undo': {
        this.requireHost(m);
        if (this.state.auction) throw new Denied('Finish this auction before undoing.');
        const last = this.state.history.pop();
        if (!last) throw new Denied('Nothing to undo.');
        this.state.game = last.game;
        this.state.offers = [];
        if (last.game.phase === 'casting') this.state.dealer = { paused: true, nextAt: null };
        if (last.label === 'seal') this.state.oscar = { stage: 'table', at: 0 };
        if (last.label === 'next reel') this.state.oscar = { stage: 'winner', at: 0 };
        this.say('Undone. The studio lawyers have shredded the evidence.');
        break;
      }

      default:
        return { changed: false };
    }
    return { changed: true };
  }

  private requireOfflineLongEnough(studioId: string, online: Set<string>, now: number) {
    if (online.has(studioId)) throw new Denied('They’re still connected.');
    const since = this.state.lastSeen[studioId] ?? 0;
    if (now - since < AUCTION.graceMs) throw new Denied('Give them until the crisis talks clock runs out.');
  }

  /** After a studio leaves mid-auction, keep the live auction honest. */
  private afterExit() {
    const g = this.state.game!;
    const a = this.state.auction;
    if (!a) return;
    if (g.phase !== 'casting' || !g.round.onTable) {
      this.state.auction = null;
      return;
    }
    if (a.high && !g.round.studios[a.high.studioId]) a.high = null;
    if (a.passed) a.passed = a.passed.filter((id) => g.round.studios[id]);
  }

  private backToLobby() {
    const g = this.state.game;
    if (g) {
      // Keep everyone seated: game ids become lobby entries again.
      this.state.lobby = g.studios.filter((s) => !s.folded).map((s) => ({ id: s.id, name: s.name, colour: s.colour }));
      for (const seat of Object.values(this.state.seats)) {
        if (seat.studioId && !this.state.lobby.some((l) => l.id === seat.studioId)) seat.studioId = null;
      }
    }
    this.state.game = null;
    this.state.history = [];
    this.resetReelExtras();
  }

  /* ------------------------------------------------------------------ */
  /*  The live auction                                                   */
  /* ------------------------------------------------------------------ */
  private bid(m: Meta, amount: number, now: number) {
    const g = this.g;
    this.requirePhase('casting');
    const a = this.state.auction;
    if (!a || !g.round.onTable) throw new Denied('Nobody is under the hammer.');
    if (m.role !== 'player' || !m.studioId) throw new Denied('Only studios can bid.');
    const rs = g.round.studios[m.studioId];
    if (!rs) throw new Denied('The Commissioner doesn’t bid.');
    if (slotsLeft(rs) <= 0) throw new Denied('Full house. You’ve got your five.');
    if (a.high?.studioId === m.studioId) throw new Denied('You’re already the top bid.');
    if (a.pausedLeft != null) throw new Denied('The auction is paused.');
    if (a.passed?.includes(m.studioId)) throw new Denied('You passed on this one.');
    const floor = a.high ? a.high.amount + 1 : RULES.minBid;
    const value = Math.floor(Number(amount));
    if (!Number.isFinite(value) || value < floor) throw new Denied(`The bid is already $${floor - 1}M. Go higher.`);
    if (value > maxBid(rs)) throw new Denied(`You can bid at most $${maxBid(rs)}M and still afford a full cast.`);
    a.high = { studioId: m.studioId, amount: value };
    a.bids += 1;
    a.endsAt = Math.max(a.endsAt, now + AUCTION.bidMs);

    // Nobody else can (or needs to) top it: close it quickly.
    const rivals = eligibleBidders(g).filter((r) => r.studioId !== m.studioId && !a.passed?.includes(r.studioId));
    const canBeat = rivals.some((r) => maxBid(r) > value);
    if (!canBeat) a.endsAt = Math.min(a.endsAt, now + (rivals.length === 0 ? 600 : AUCTION.settledMs));
  }

  /** Turns the next card. Vault legends announce themselves. */
  private deal(now: number) {
    const g = this.g;
    if (castingComplete(g) || g.round.onTable) return;
    this.snapshot('draw');
    const next = draw(g);
    this.setGame(next);
    const card = next.round.onTable!;
    this.state.auction = { cardId: card.id, high: null, endsAt: now + AUCTION.openMs, bids: 0, passed: [], pausedLeft: null };
    this.dealer.nextAt = null;
    if (card.deck === 'legacy') this.say(`The vault opens. ${card.name} is in the room.`, 'vault');
  }

  /** Not for me. Once every studio that could bid has passed, the card goes. */
  private pass(m: Meta, now: number) {
    const g = this.g;
    this.requirePhase('casting');
    const a = this.state.auction;
    if (!a || !g.round.onTable) throw new Denied('Nobody is under the hammer.');
    if (m.role !== 'player' || !m.studioId) throw new Denied('Only studios can pass.');
    const rs = g.round.studios[m.studioId];
    if (!rs) throw new Denied('The Commissioner doesn’t bid.');
    if (a.high?.studioId === m.studioId) throw new Denied('You’re the top bid. You can’t pass now.');
    a.passed = [...new Set([...(a.passed ?? []), m.studioId])];
    const still = eligibleBidders(g).filter((r) => r.studioId !== a.high?.studioId && !a.passed!.includes(r.studioId));
    if (still.length === 0 && a.pausedLeft == null) {
      a.endsAt = Math.min(a.endsAt, now + (a.high ? AUCTION.settledMs : AUCTION.allPassedMs));
    }
  }

  /** Sell to the top bid, or bin the card if nobody bid. */
  private resolveAuction(now = this.now) {
    const a = this.state.auction;
    const g = this.g;
    if (!a || !g.round.onTable) throw new Denied('Nobody is under the hammer.');
    const card = g.round.onTable;
    if (a.high) {
      const rs = g.round.studios[a.high.studioId];
      if (rs && slotsLeft(rs) > 0 && a.high.amount <= maxBid(rs)) {
        this.setGame(sell(g, a.high.studioId, a.high.amount));
        this.say(`Sold. ${card.name} signs with ${this.name(a.high.studioId)} for $${a.high.amount}M.`, 'sold');
      } else {
        this.setGame(bin(g));
        this.say(`No deal. ${card.name} walks.`);
      }
    } else {
      this.setGame(bin(g));
      this.say(`No takers. ${card.name} goes back to their trailer.`);
    }
    this.state.auction = null;
    if (!castingComplete(this.g)) this.dealer.nextAt = now + AUCTION.dealGapMs;
  }

  private saveNotes(studioId: string, patch: Partial<PitchNotes>) {
    const notes = (this.state.notes ??= {});
    const mine = (notes[studioId] ??= emptyNotes());
    for (const key of Object.keys(NOTE_LIMITS) as (keyof typeof NOTE_LIMITS)[]) {
      const v = patch?.[key];
      if (typeof v === 'string') mine[key] = v.slice(0, NOTE_LIMITS[key]);
    }
    if (patch?.roles && typeof patch.roles === 'object') {
      const cast = new Set(this.g.round.studios[studioId].cast.map((c) => c.id));
      for (const [id, v] of Object.entries(patch.roles)) if (cast.has(id) && typeof v === 'string') mine.roles[id] = v.slice(0, MAX_ROLE);
    }
  }

  private offer(m: Meta, to: string, fromGives: TradeSide, toGives: TradeSide) {
    this.requirePhase('trading');
    if (m.role !== 'player' || !m.studioId) throw new Denied('Only studios can make deals.');
    const clean = (s: TradeSide): TradeSide => ({
      cardIds: Array.isArray(s?.cardIds) ? s.cardIds.map(String).slice(0, RULES.castSize) : [],
      cash: Math.max(0, Math.floor(Number(s?.cash) || 0)),
      iou: Math.max(0, Math.floor(Number(s?.iou) || 0)),
    });
    const terms = { a: m.studioId, b: String(to), aGives: clean(fromGives), bGives: clean(toGives) };
    const problem = validateTrade(this.g, terms);
    if (problem) throw new Denied(problem);
    this.state.offers = this.state.offers.filter((o) => o.from !== m.studioId);
    this.state.offers.push({ id: token().slice(0, 10), from: terms.a, to: terms.b, fromGives: terms.aGives, toGives: terms.bGives });
    this.say(`${this.name(terms.a)} has sent ${this.name(terms.b)} an offer.`);
  }

  private clockAction(kind: 'clockStart' | 'clockPause' | 'clockReset' | 'nextPitch', now: number) {
    const c = this.state.clock;
    const remaining = () => Math.max(0, c.remainingMs - (c.runningSince ? now - c.runningSince : 0));
    if (kind === 'clockStart') {
      if (!c.runningSince && c.remainingMs > 0) c.runningSince = now;
    } else if (kind === 'clockPause') {
      if (c.runningSince) this.state.clock = { remainingMs: remaining(), runningSince: null };
    } else if (kind === 'clockReset') {
      this.state.clock = { remainingMs: PITCH_MS, runningSince: null };
    } else {
      this.setGame(nextPitch(this.g));
      this.state.clock = { remainingMs: PITCH_MS, runningSince: null };
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Timers                                                             */
  /* ------------------------------------------------------------------ */
  nextAlarm(): number | null {
    const times: number[] = [];
    if (this.state.auction && this.state.auction.pausedLeft == null) times.push(this.state.auction.endsAt);
    const d = this.state.dealer;
    if (!this.state.auction && this.state.game?.phase === 'casting' && d && !d.paused && d.nextAt != null) times.push(d.nextAt);
    if (this.state.game?.phase === 'oscar' && this.state.oscar.stage === 'drumroll') times.push(this.state.oscar.at);
    return times.length ? Math.min(...times) : null;
  }

  /** Runs anything that is due. Returns true if the room changed. */
  tick(now: number): boolean {
    let changed = false;
    if (this.state.auction && this.state.auction.pausedLeft == null && now >= this.state.auction.endsAt - 20) {
      try {
        this.resolveAuction(now);
      } catch {
        this.state.auction = null;
      }
      changed = true;
    }
    const d = this.state.dealer;
    if (!this.state.auction && this.state.game?.phase === 'casting' && d && !d.paused && d.nextAt != null && now >= d.nextAt - 20) {
      d.nextAt = null;
      try {
        this.deal(now);
      } catch {
        /* casting closed */
      }
      changed = true;
    }
    if (this.state.game?.phase === 'oscar' && this.state.oscar.stage === 'drumroll' && now >= this.state.oscar.at - 20) {
      this.state.oscar = { stage: 'winner', at: now };
      changed = true;
    }
    return changed;
  }

  private hostAwayAt(online: Set<string>, now: number) {
    const keep = [this.online, this.now] as const;
    this.online = online;
    this.now = now;
    const away = this.hostAway();
    [this.online, this.now] = keep;
    return away;
  }

  markSeen(id: string, now: number) {
    this.state.lastSeen[id] = now;
  }

  /* ------------------------------------------------------------------ */
  /*  What each device may see                                           */
  /* ------------------------------------------------------------------ */
  viewFor(m: Meta, online: Set<string>, now: number): View {
    const s = this.state;
    let game: Game | null = null;
    let deck = { talent: 0, legendsLeft: 0 };
    if (s.game) {
      const g = clone(s.game);
      deck = { talent: g.round.talentDeck.length, legendsLeft: legendsLeft(g) };
      g.round.talentDeck = [];
      g.round.legacyDeck = [];
      g.round.legacySlots = [];

      const isComm = this.isCommissioner(m);
      const genreOpen = ['reveal', 'trading', 'prep', 'pitching', 'scoring', 'oscar', 'ceremony', 'final'].includes(g.phase);
      if (!isComm && !genreOpen) {
        g.round.genre = '';
        g.genresUsed = g.genresUsed.slice(0, -1);
      }

      const sealed = g.phase === 'scoring' || (g.phase === 'oscar' && s.oscar.stage !== 'winner');
      if (sealed && !isComm) {
        if (g.phase === 'oscar') {
          for (const [id, card] of Object.entries(g.round.scores)) g.points[id] = (g.points[id] ?? 0) - cardTotal(card);
          g.films = g.films.filter((f) => !(f.gameId === g.id && f.round === g.round.number));
          g.round.winnerId = null;
        }
        for (const id of Object.keys(g.round.scores)) g.round.scores[id] = { casting: 0, budget: 0, plot: 0 };
      }
      game = g;
    }

    const offers =
      m.role === 'screen' ? s.offers : s.offers.filter((o) => m.studioId && (o.from === m.studioId || o.to === m.studioId));

    return {
      code: s.code,
      serverNow: now,
      you: { role: m.role, studioId: m.studioId, isHost: this.isHost(m) },
      host: { studioId: this.hostStudio(), away: this.hostAwayAt(online, now) },
      lobby: s.lobby,
      online: [...online],
      lastSeen: s.lastSeen,
      game,
      deck,
      auction: s.auction,
      clock: s.clock,
      prep: s.prep!,
      dealer: s.dealer!,
      notes: m.role === 'player' && m.studioId ? s.notes?.[m.studioId] ?? null : null,
      oscar: s.oscar,
      offers,
      event: s.event,
      canUndo: s.history.length > 0 && !s.auction,
      shopUrl: s.shopUrl,
    };
  }
}
