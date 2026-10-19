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
import type { Action, Auction, ClientMsg, Clock, LobbyStudio, Offer, OscarStage, Role, RoomEvent, View } from './protocol';
import { AUCTION } from './protocol';

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
  oscar: { stage: OscarStage; at: number };
  offers: Offer[];
  lastSeen: Record<string, number>;
  history: { game: Game; label: string }[];
  event: RoomEvent | null;
  eventSeq: number;
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
    oscar: { stage: 'table', at: 0 },
    offers: [],
    lastSeen: {},
    history: [],
    event: null,
    eventSeq: 0,
  };
}

export class RoomCore {
  constructor(public state: RoomState) {}

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

  /** The Commissioner, or the big screen standing in for them on public controls. */
  private requireRunner(m: Meta) {
    if (!(m.role === 'screen' || this.isCommissioner(m))) throw new Denied('That’s the Commissioner’s call.');
  }

  private requireCommissioner(m: Meta) {
    if (!this.isCommissioner(m)) throw new Denied('Only the Commissioner can do that.');
  }

  private requireScreen(m: Meta) {
    if (m.role !== 'screen') throw new Denied('Only the big screen can do that.');
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
    try {
      switch (msg.t) {
        case 'hello':
          return this.hello(meta, msg.token ?? null, !!msg.create);
        case 'join':
          return this.join(meta, msg.name, msg.colour);
        case 'takeover':
          return this.takeover(meta, msg.studioId, online, now);
        case 'claimScreen':
          return this.claimScreen(meta, online);
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
    const hasScreen = Object.values(this.state.seats).some((s) => s.role === 'screen');
    if (create) {
      if (hasScreen) throw new Denied('That room code is taken.');
      const t = token();
      this.state.seats[t] = { role: 'screen', studioId: null };
      return { changed: true, meta: { token: t, role: 'screen', studioId: null }, reply: { t: 'welcome', token: t, role: 'screen', studioId: null } };
    }
    if (!hasScreen) throw new Denied('No game with that code. Check the code on the big screen.');
    return { changed: false, meta: { token: null, role: 'guest', studioId: null }, reply: { t: 'welcome', token: null, role: 'guest', studioId: null } };
  }

  private join(meta: Meta, rawName: string, colour: string): Outcome {
    if (this.state.game) throw new Denied('This game has already started. Take over a studio instead.');
    if (meta.role === 'screen') throw new Denied('The big screen can’t join as a studio.');
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
    if (meta.role === 'screen') throw new Denied('The big screen can’t run a studio.');
    const inLobby = !this.state.game && this.state.lobby.find((l) => l.id === studioId);
    const studio = this.state.game?.studios.find((s) => s.id === studioId);
    if (!inLobby && (!studio || studio.folded)) throw new Denied('That studio isn’t available.');
    if (online.has(studioId)) throw new Denied('That studio is still connected on another phone.');
    for (const [t, s] of Object.entries(this.state.seats)) if (s.studioId === studioId) delete this.state.seats[t];
    const t = token();
    this.state.seats[t] = { role: 'player', studioId };
    this.state.lastSeen[studioId] = now;
    const name = inLobby ? inLobby.name : studio!.name;
    this.say(`${name} is under new management.`);
    return { changed: true, meta: { token: t, role: 'player', studioId }, reply: { t: 'welcome', token: t, role: 'player', studioId } };
  }

  private claimScreen(meta: Meta, online: Set<string>): Outcome {
    if (online.has('screen')) throw new Denied('The big screen is still connected.');
    if (meta.role === 'player') throw new Denied('Leave your studio before becoming the big screen.');
    for (const [t, s] of Object.entries(this.state.seats)) if (s.role === 'screen') delete this.state.seats[t];
    const t = token();
    this.state.seats[t] = { role: 'screen', studioId: null };
    return { changed: true, meta: { token: t, role: 'screen', studioId: null }, reply: { t: 'welcome', token: t, role: 'screen', studioId: null } };
  }

  private start(meta: Meta, settings: Settings): Outcome {
    this.requireScreen(meta);
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
    this.state.oscar = { stage: 'table', at: 0 };
  }

  /* ------------------------------------------------------------------ */
  /*  Game actions                                                       */
  /* ------------------------------------------------------------------ */
  private act(m: Meta, action: Action, now: number, online: Set<string>): Outcome {
    if (!this.state.game && action.a === 'fold') {
      this.requireScreen(m);
      const entry = this.state.lobby.find((l) => l.id === action.studioId);
      if (!entry) throw new Denied('That studio has already left.');
      this.state.lobby = this.state.lobby.filter((l) => l.id !== entry.id);
      for (const [t, seat] of Object.entries(this.state.seats)) if (seat.studioId === entry.id) delete this.state.seats[t];
      this.say(`${entry.name} has left the building.`);
      return { changed: true };
    }
    if (action.a === 'backToLobby') {
      this.requireScreen(m);
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
        break;

      case 'draw': {
        this.requireRunner(m);
        this.requirePhase('casting');
        if (this.state.auction) throw new Denied('There’s already a star under the hammer.');
        this.snapshot('draw');
        const next = draw(g);
        this.setGame(next);
        const card = next.round.onTable!;
        this.state.auction = { cardId: card.id, high: null, endsAt: now + AUCTION.openMs, bids: 0 };
        if (card.deck === 'legacy') this.say(`The vault opens. ${card.name} is in the room.`, 'vault');
        break;
      }

      case 'bid':
        this.bid(m, action.amount, now);
        break;

      case 'hammer':
        this.requireRunner(m);
        this.resolveAuction();
        break;

      case 'bin':
        this.requireRunner(m);
        if (!this.state.auction) throw new Denied('Nobody is on the table.');
        if (this.state.auction.high) throw new Denied('There’s a bid on the table. Hammer it instead.');
        this.resolveAuction();
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
        break;

      case 'firstPitch':
        this.requireRunner(m);
        this.requirePhase('prep');
        this.setGame(setPhase(g, 'pitching'));
        this.state.clock = { remainingMs: PITCH_MS, runningSince: null };
        break;

      case 'clockStart':
      case 'clockPause':
      case 'clockReset':
      case 'nextPitch': {
        this.requirePhase('pitching');
        const onStage = g.round.pitchOrder[g.round.pitchCursor];
        if (!(m.role === 'screen' || this.isCommissioner(m) || m.studioId === onStage)) throw new Denied('It’s not your pitch.');
        this.clockAction(action.a, now);
        break;
      }

      case 'title': {
        this.requirePhase('prep', 'pitching', 'scoring');
        if (m.role !== 'player' || !m.studioId || !g.round.studios[m.studioId]) throw new Denied('Only a pitching studio can title a film.');
        this.setGame(setTitle(g, m.studioId, String(action.title ?? '').slice(0, MAX_TITLE)));
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
        this.setGame(lockScores(g, action.vote));
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
        if (!(m.role === 'screen' || m.studioId === g.round.winnerId)) throw new Denied('Only the greenlit studio can write the logline.');
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
        this.requireScreen(m);
        this.requirePhase('final');
        this.setGame(settleTie(g, action.studioId));
        break;

      case 'fold': {
        this.requireScreen(m);
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
        this.requireScreen(m);
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
        this.requireScreen(m);
        if (this.state.auction) throw new Denied('Finish this auction before undoing.');
        const last = this.state.history.pop();
        if (!last) throw new Denied('Nothing to undo.');
        this.state.game = last.game;
        this.state.offers = [];
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
    const floor = a.high ? a.high.amount + 1 : RULES.minBid;
    const value = Math.floor(Number(amount));
    if (!Number.isFinite(value) || value < floor) throw new Denied(`The bid is already $${floor - 1}M. Go higher.`);
    if (value > maxBid(rs)) throw new Denied(`You can bid at most $${maxBid(rs)}M and still afford a full cast.`);
    a.high = { studioId: m.studioId, amount: value };
    a.bids += 1;
    a.endsAt = Math.max(a.endsAt, now + AUCTION.bidMs);

    // Nobody else can (or needs to) top it: close it quickly.
    const rivals = eligibleBidders(g).filter((r) => r.studioId !== m.studioId);
    const canBeat = rivals.some((r) => maxBid(r) > value);
    if (!canBeat) a.endsAt = Math.min(a.endsAt, now + (rivals.length === 0 ? 600 : AUCTION.settledMs));
  }

  /** Sell to the top bid, or bin the card if nobody bid. */
  private resolveAuction() {
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
    if (this.state.auction) times.push(this.state.auction.endsAt);
    if (this.state.game?.phase === 'oscar' && this.state.oscar.stage === 'drumroll') times.push(this.state.oscar.at);
    return times.length ? Math.min(...times) : null;
  }

  /** Runs anything that is due. Returns true if the room changed. */
  tick(now: number): boolean {
    let changed = false;
    if (this.state.auction && now >= this.state.auction.endsAt - 20) {
      try {
        this.resolveAuction();
      } catch {
        this.state.auction = null;
      }
      changed = true;
    }
    if (this.state.game?.phase === 'oscar' && this.state.oscar.stage === 'drumroll' && now >= this.state.oscar.at - 20) {
      this.state.oscar = { stage: 'winner', at: now };
      changed = true;
    }
    return changed;
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
      you: { role: m.role, studioId: m.studioId },
      lobby: s.lobby,
      online: [...online],
      lastSeen: s.lastSeen,
      game,
      deck,
      auction: s.auction,
      clock: s.clock,
      oscar: s.oscar,
      offers,
      event: s.event,
      canUndo: s.history.length > 0 && !s.auction,
      shopUrl: s.shopUrl,
    };
  }
}
