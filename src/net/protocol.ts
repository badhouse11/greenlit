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
  you: { role: Role; studioId: string | null };
  lobby: LobbyStudio[];
  online: string[]; // studio ids, plus 'screen'
  lastSeen: Record<string, number>;
  game: Game | null; // secrets stripped for this device
  deck: { talent: number; legendsLeft: number };
  auction: Auction | null;
  clock: Clock;
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
  | { t: 'claimScreen' }
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
  oscarDrumrollMs: 3400,
  graceMs: 180000, // crisis talks before a studio can be folded
};

/** Room codes avoid letters that read badly on a TV (I, O, Q, S, Z). */
export const CODE_LETTERS = 'ABCDEFGHJKLMNPRTUVWXY';
export const makeRoomCode = (rng: () => number = Math.random) =>
  Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(rng() * CODE_LETTERS.length)]).join('');
export const isRoomCode = (s: string) => new RegExp(`^[${CODE_LETTERS}]{4}$`).test(s);
