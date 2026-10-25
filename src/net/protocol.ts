/**
 * The wire format between the room server and every device in the room.
 * Shared by the server (Cloudflare) and the browser, so both always agree.
 */
import type { Game, ScoreCategory, Settings, TradeSide } from '../game/types';

export type Role = 'screen' | 'player' | 'guest';

export interface LobbyStudio {
  id: string;
  name: string;
  colour: string;
}

export interface Auction {
  cardId: string;
  high: { studioId: string; amount: number } | null;
  endsAt: number; // server clock, ms
  bids: number; // how many bids so far, for the screen's ticker
  passed?: string[]; // studios that have passed on this star
  pausedLeft?: number | null; // set while the dealer is paused: time left on the lot
}

/** The automatic dealer: a new star comes up a few seconds after the last one goes. */
export interface Dealer {
  paused: boolean;
  nextAt: number | null; // server clock, ms
}

/** A studio's private pitch notes, written on its own phone during pitch prep. */
export interface PitchNotes {
  oneLiner: string;
  start: string;
  middle: string;
  end: string;
  roles: Record<string, string>; // card id -> who they play
  bigMoment: string;
}

export const emptyNotes = (): PitchNotes => ({ oneLiner: '', start: '', middle: '', end: '', roles: {}, bigMoment: '' });

export type PrepStepKey = 'oneLiner' | 'story' | 'roles' | 'bigMoment' | 'title';

/** Pitch prep, one timed step at a time. The title comes last, once you know your film. */
export const PREP_STEPS: { key: PrepStepKey; label: string; minutes: number }[] = [
  { key: 'oneLiner', label: 'The one-liner', minutes: 1 },
  { key: 'story', label: 'The story', minutes: 3 },
  { key: 'roles', label: 'Who plays who', minutes: 2 },
  { key: 'bigMoment', label: 'The big moment', minutes: 1 },
  { key: 'title', label: 'The title', minutes: 1 },
];
export const PREP_MS = PREP_STEPS.reduce((n, s) => n + s.minutes * 60000, 0);

/** Which step the room's prep clock is on, from the time used so far. PREP_STEPS.length = pencils down. */
export function prepStepAt(usedMs: number): number {
  let edge = 0;
  for (let i = 0; i < PREP_STEPS.length; i++) {
    edge += PREP_STEPS[i].minutes * 60000;
    if (usedMs < edge) return i;
  }
  return PREP_STEPS.length;
}

/** Time left in the given step, from the time used so far. */
export function prepStepLeft(usedMs: number, step: number): number {
  const edge = PREP_STEPS.slice(0, step + 1).reduce((n, s) => n + s.minutes * 60000, 0);
  return Math.max(0, edge - usedMs);
}

export interface Clock {
  remainingMs: number;
  runningSince: number | null;
}

export interface Offer {
  id: string;
  from: string;
  to: string;
  fromGives: TradeSide;
  toGives: TradeSide;
}

export type OscarStage = 'table' | 'drumroll' | 'winner';

export interface RoomEvent {
  id: number;
  text: string;
  tone?: 'vault' | 'sold' | 'alarm';
}

/** Everything one device is allowed to know, right now. */
export interface View {
  code: string;
  serverNow: number;
  you: { role: Role; studioId: string | null; isHost: boolean };
  host: { studioId: string | null; away: boolean };
  lobby: LobbyStudio[];
  online: string[]; // studio ids, plus 'screen'
  lastSeen: Record<string, number>;
  game: Game | null; // secrets stripped for this device
  deck: { talent: number; legendsLeft: number };
  auction: Auction | null;
  clock: Clock;
  prep: Clock; // the pitch prep clock
  dealer: Dealer;
  notes: PitchNotes | null; // this device's own pitch notes only
  oscar: { stage: OscarStage; at: number };
  offers: Offer[];
  event: RoomEvent | null;
  canUndo: boolean;
  shopUrl?: string;
}

export type Action =
  | { a: 'toCommission' }
  | { a: 'toCasting' }
  | { a: 'draw' }
  | { a: 'bid'; amount: number }
  | { a: 'pass' }
  | { a: 'dealPause' }
  | { a: 'dealResume' }
  | { a: 'hammer' }
  | { a: 'bin' }
  | { a: 'openEnvelope' }
  | { a: 'toTrading' }
  | { a: 'offer'; to: string; fromGives: TradeSide; toGives: TradeSide }
  | { a: 'acceptOffer'; id: string }
  | { a: 'declineOffer'; id: string }
  | { a: 'cancelOffer' }
  | { a: 'closeTrading' }
  | { a: 'firstPitch' }
  | { a: 'clockStart' }
  | { a: 'clockPause' }
  | { a: 'clockReset' }
  | { a: 'nextPitch' }
  | { a: 'title'; title: string }
  | { a: 'notes'; notes: Partial<PitchNotes> }
  | { a: 'prepPause' }
  | { a: 'prepResume' }
  | { a: 'score'; studioId: string; cat: ScoreCategory; value: number }
  | { a: 'seal'; vote?: string }
  | { a: 'oscarOpen' }
  | { a: 'toCeremony' }
  | { a: 'logline'; text: string }
  | { a: 'nextReel' }
  | { a: 'tieBreak'; studioId: string }
  | { a: 'fold'; studioId: string }
  | { a: 'fireCommissioner' }
  | { a: 'undo' }
  | { a: 'backToLobby' };

export type ClientMsg =
  | { t: 'hello'; token?: string | null; create?: boolean }
  | { t: 'join'; name: string; colour: string }
  | { t: 'takeover'; studioId: string }
  | { t: 'watch' }
  | { t: 'start'; settings: Settings }
  | { t: 'act'; action: Action }
  | { t: 'ping' };

export type ServerMsg =
  | { t: 'welcome'; token: string | null; role: Role; studioId: string | null }
  | { t: 'state'; view: View }
  | { t: 'error'; message: string }
  | { t: 'pong'; serverNow: number };

/** Timings for the live auction, in milliseconds. */
export const AUCTION = {
  openMs: 15000, // time for the first bid before the card is binned
  bidMs: 8000, // each new bid resets the clock to at least this
  settledMs: 2500, // nobody else can afford to outbid: sold quickly
  allPassedMs: 900, // everyone passed and nobody bid: binned almost at once
  dealGapMs: 3000, // breather between one star going and the next coming up
  firstDealMs: 2500, // after the commission is sealed
  oscarDrumrollMs: 3400,
  graceMs: 180000, // crisis talks before a studio can be folded
  hostAwayMs: 20000, // the host's phone has been gone this long: anyone can step in
};

/** Room codes avoid letters that read badly on a TV (I, O, Q, S, Z). */
export const CODE_LETTERS = 'ABCDEFGHJKLMNPRTUVWXY';
export const makeRoomCode = (rng: () => number = Math.random) =>
  Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(rng() * CODE_LETTERS.length)]).join('');
export const isRoomCode = (s: string) => new RegExp(`^[${CODE_LETTERS}]{4}$`).test(s);
