export type DeckKind = 'talent' | 'legacy';

export interface Card {
  id: string;
  name: string;
  deck: DeckKind;
}

export interface Studio {
  id: string;
  name: string;
  colour: string; // key into PALETTE
}

export interface CastMember extends Card {
  price: number; // what the studio paid at auction ($M)
}

export interface RoundStudio {
  studioId: string;
  startBudget: number;
  budget: number; // cash left this round ($M)
  cast: CastMember[];
  traded: boolean;
  title: string;
}

export interface Sale {
  card: Card;
  studioId: string | null; // null = nobody bit, card binned
  price: number;
}

export interface TradeSide {
  cardIds: string[];
  cash: number; // from this round's remaining budget
  iou: number; // promised from next playing round's budget
}

export interface Trade {
  id: string;
  round: number;
  a: string;
  b: string;
  aGives: TradeSide;
  bGives: TradeSide;
}

export interface Iou {
  id: string;
  round: number;
  fromId: string;
  toId: string;
  amount: number;
  fromSettled: boolean;
  toSettled: boolean;
}

export type Phase =
  | 'handover'
  | 'commission'
  | 'casting'
  | 'reveal'
  | 'trading'
  | 'prep' // "get your pitches ready"
  | 'pitching' // two minutes per studio, on the clock
  | 'scoring' // Commissioner punches loyalty cards in private
  | 'oscar' // phone on the table, the big reveal
  | 'ceremony'
  | 'final';

export type ScoreCategory = 'casting' | 'budget' | 'plot';

export type Scorecard = Record<ScoreCategory, number>;

export interface Round {
  number: number; // 1-based
  commissionerId: string;
  genre: string;
  talentDeck: Card[];
  legacyDeck: Card[];
  onTable: Card | null;
  sales: Sale[];
  studios: Record<string, RoundStudio>;
  trades: Trade[];
  pitchOrder: string[];
  pitchCursor: number; // which studio is on the clock
  legacySlots: number[]; // secret draw numbers where a vault legend surfaces
  drawCount: number;
  scores: Record<string, Scorecard>;
  winnerId: string | null;
  logline: string;
}

export interface GreenlitFilm {
  id: string;
  gameId: string;
  gameDate: string;
  round: number;
  title: string;
  logline: string;
  genre: string;
  studioId: string;
  studioName: string;
  studioColour: string;
  commissionerName: string;
  cast: { name: string; deck: DeckKind; price: number }[];
  score?: Scorecard;
}

export interface Settings {
  directorsCut: boolean;
}

export interface Game {
  id: string;
  createdAt: string;
  studios: Studio[];
  order: string[]; // commissioner order, one round each
  roundIndex: number; // 0-based
  phase: Phase;
  round: Round;
  ious: Iou[];
  genresUsed: string[];
  films: GreenlitFilm[];
  points: Record<string, number>;
  settings: Settings;
  tieBreakWinnerId: string | null;
}
