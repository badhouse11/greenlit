import talentData from '../data/talent.json';
import legacyData from '../data/legacy.json';
import genreData from '../data/genres.json';
import type {
  Card,
  Game,
  GreenlitFilm,
  Iou,
  Round,
  RoundStudio,
  ScoreCategory,
  Scorecard,
  Settings,
  Studio,
  Trade,
  TradeSide,
} from './types';

/* ------------------------------------------------------------------ */
/*  House rules. Change them here and the whole game follows.          */
/* ------------------------------------------------------------------ */
export const RULES = {
  startingBudget: 20, // $M per studio per round
  castSize: 5,
  minBid: 1,
  maxIouPerStudio: 15, // keeps at least $5M for five $1M stars next round
  tradesPerStudio: 1,
  minStudios: 3,
  maxStudios: 8,
  stampsPerCategory: 5, // loyalty-card punches per scoring category
  pitchSeconds: 120,
} as const;

export const CATEGORIES: { key: ScoreCategory; label: string; hint: string }[] = [
  { key: 'casting', label: 'Casting', hint: 'How impressive is this line-up, and how well is it used?' },
  { key: 'budget', label: 'Budget', hint: 'Did they spend wisely? Reward coming in under budget.' },
  { key: 'plot', label: 'Plot', hint: 'Is it a film you’d actually greenlight?' },
];

/** Legends hidden in each reel: one per two competing studios, between one and three. */
export const legacyPerReel = (competitors: number) => Math.min(3, Math.max(1, Math.round(competitors / 2)));

export const TALENT: Card[] = talentData.cards.map((c) => ({ ...c, deck: 'talent' as const }));
export const LEGACY: Card[] = legacyData.cards.map((c) => ({ ...c, deck: 'legacy' as const }));
export const GENRES: { id: string; name: string; pack: string }[] = genreData.cards;

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */
export function shuffle<T>(input: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter}`;
}

const clone = <T>(v: T): T => structuredClone(v);

export class RuleError extends Error {}

/* ------------------------------------------------------------------ */
/*  Lookups                                                            */
/* ------------------------------------------------------------------ */
export const studioById = (g: Game, id: string): Studio => {
  const s = g.studios.find((x) => x.id === id);
  if (!s) throw new RuleError(`Unknown studio ${id}`);
  return s;
};

export const totalRounds = (g: Game) => g.order.length;
export const isFinalRound = (g: Game) => g.roundIndex === g.order.length - 1;
export const commissioner = (g: Game) => studioById(g, g.round.commissionerId);

/** Competing studios this round, in seating order. */
export const playing = (g: Game): RoundStudio[] =>
  g.studios.filter((s) => g.round.studios[s.id]).map((s) => g.round.studios[s.id]);

export const slotsLeft = (rs: RoundStudio) => RULES.castSize - rs.cast.length;

/** Highest legal bid: must keep $1M back for every other empty slot. */
export const maxBid = (rs: RoundStudio) => {
  const left = slotsLeft(rs);
  if (left <= 0) return 0;
  return Math.max(0, rs.budget - (left - 1) * RULES.minBid);
};

/** Skint = every remaining slot can only be filled at the minimum bid. */
export const isSkint = (rs: RoundStudio) => slotsLeft(rs) > 0 && maxBid(rs) <= RULES.minBid;

export const eligibleBidders = (g: Game) => playing(g).filter((rs) => slotsLeft(rs) > 0);

export const castingComplete = (g: Game) => playing(g).every((rs) => slotsLeft(rs) === 0);

export const tokens = (g: Game, studioId: string) => g.films.filter((f) => f.studioId === studioId).length;

export const points = (g: Game, studioId: string) => g.points[studioId] ?? 0;

/** Ranked by points; greenlights break a points tie. */
export const standings = (g: Game) =>
  g.studios
    .map((s) => ({ studio: s, points: points(g, s.id), tokens: tokens(g, s.id) }))
    .sort((x, y) => y.points - x.points || y.tokens - x.tokens || g.studios.indexOf(x.studio) - g.studios.indexOf(y.studio));

export const leaders = (g: Game) => {
  const table = standings(g);
  const top = table[0];
  if (!top) return [];
  return table.filter((r) => r.points === top.points && r.tokens === top.tokens).map((r) => r.studio.id);
};

/* ---------- scoring ---------- */
export const emptyCard = (): Scorecard => ({ casting: 0, budget: 0, plot: 0 });
export const cardTotal = (c: Scorecard | undefined) => (c ? c.casting + c.budget + c.plot : 0);
export const maxReelScore = () => RULES.stampsPerCategory * CATEGORIES.length;

/** Studios on the highest score this reel. */
export const reelLeaders = (g: Game) => {
  const totals = playing(g).map((rs) => ({ id: rs.studioId, total: cardTotal(g.round.scores[rs.studioId]) }));
  const top = Math.max(...totals.map((t) => t.total));
  return totals.filter((t) => t.total === top).map((t) => t.id);
};

/** Does this studio compete in any round after the current one? */
export const hasFuturePlay = (g: Game, studioId: string) =>
  g.order.some((cid, idx) => idx > g.roundIndex && cid !== studioId);

export const outstandingDebt = (g: Game, studioId: string) =>
  g.ious.filter((i) => i.fromId === studioId && !i.fromSettled).reduce((n, i) => n + i.amount, 0);

export const outstandingCredit = (g: Game, studioId: string) =>
  g.ious.filter((i) => i.toId === studioId && !i.toSettled).reduce((n, i) => n + i.amount, 0);

/** What the studio will start its next competing round with. */
export const nextBudget = (g: Game, studioId: string) =>
  RULES.startingBudget + outstandingCredit(g, studioId) - outstandingDebt(g, studioId);

/* ------------------------------------------------------------------ */
/*  Game creation and round set-up                                     */
/* ------------------------------------------------------------------ */
export interface NewStudio {
  name: string;
  colour: string;
}

export function createGame(input: NewStudio[], settings: Settings, order?: number[]): Game {
  if (input.length < RULES.minStudios || input.length > RULES.maxStudios) {
    throw new RuleError(`GREENLIT needs ${RULES.minStudios}–${RULES.maxStudios} studios.`);
  }
  const studios: Studio[] = input.map((s, i) => ({
    id: `s${i + 1}`,
    name: s.name.trim() || `Studio ${i + 1}`,
    colour: s.colour,
  }));
  const seq = order ?? shuffle(studios.map((_, i) => i));
  const g: Game = {
    id: uid('game'),
    createdAt: new Date().toISOString(),
    studios,
    order: seq.map((i) => studios[i].id),
    roundIndex: 0,
    phase: 'handover',
    round: null as unknown as Round,
    ious: [],
    genresUsed: [],
    films: [],
    points: Object.fromEntries(studios.map((s) => [s.id, 0])),
    settings,
    tieBreakWinnerId: null,
  };
  return setUpRound(g, 0);
}

function pickGenre(g: Game): string {
  const pool = GENRES.filter((x) => x.pack === 'core' || g.settings.directorsCut).map((x) => x.name);
  let fresh = pool.filter((n) => !g.genresUsed.includes(n));
  if (fresh.length === 0) fresh = pool;
  return shuffle(fresh)[0];
}

function setUpRound(input: Game, idx: number): Game {
  const g = clone(input);
  const commissionerId = g.order[idx];
  const genre = pickGenre(g);
  g.genresUsed.push(genre);

  const studios: Record<string, RoundStudio> = {};
  for (const s of g.studios) {
    if (s.id === commissionerId) continue;
    let budget = RULES.startingBudget;
    for (const iou of g.ious) {
      if (iou.toId === s.id && !iou.toSettled) {
        budget += iou.amount;
        iou.toSettled = true;
      }
      if (iou.fromId === s.id && !iou.fromSettled) {
        budget -= iou.amount;
        iou.fromSettled = true;
      }
    }
    studios[s.id] = { studioId: s.id, startBudget: budget, budget, cast: [], traded: false, title: '' };
  }

  // Hide the vault legends at secret draw numbers. Every number is below the total
  // cast size, so each legend is guaranteed to surface before casting closes.
  const competitors = Object.keys(studios).length;
  const totalSlots = competitors * RULES.castSize;
  const legacySlots = shuffle(Array.from({ length: totalSlots - 1 }, (_, i) => i + 1))
    .slice(0, legacyPerReel(competitors))
    .sort((x, y) => x - y);

  g.roundIndex = idx;
  g.phase = 'handover';
  g.round = {
    number: idx + 1,
    commissionerId,
    genre,
    talentDeck: shuffle(TALENT),
    legacyDeck: shuffle(LEGACY),
    onTable: null,
    sales: [],
    studios,
    trades: [],
    pitchOrder: shuffle(Object.keys(studios)),
    pitchCursor: 0,
    legacySlots,
    drawCount: 0,
    scores: Object.fromEntries(Object.keys(studios).map((id) => [id, emptyCard()])),
    winnerId: null,
    logline: '',
  };
  return g;
}

export function setPhase(g: Game, phase: Game['phase']): Game {
  if (phase === 'reveal' && !castingComplete(g)) throw new RuleError('Every studio needs five stars first.');
  return { ...g, phase };
}

/* ------------------------------------------------------------------ */
/*  The casting auction                                                */
/* ------------------------------------------------------------------ */
/** Is the next draw one of the reel's hidden vault slots? */
export const nextIsLegacy = (g: Game) => g.round.legacySlots.includes(g.round.drawCount);

export const legendsLeft = (g: Game) => g.round.legacySlots.filter((n) => n >= g.round.drawCount).length;

/** Draws the next star. Vault legends surface on their own, at secret points in the reel. */
export function draw(input: Game): Game {
  if (input.round.onTable) throw new RuleError('Sell or bin the star on the table first.');
  if (castingComplete(input)) throw new RuleError('Casting is closed. Every studio has five stars.');
  const g = clone(input);
  const fromVault = nextIsLegacy(g) && g.round.legacyDeck.length > 0;
  const card = (fromVault ? g.round.legacyDeck : g.round.talentDeck).shift();
  if (!card) throw new RuleError('The Talent Deck is empty.');
  g.round.onTable = card;
  g.round.drawCount += 1;
  return g;
}

export function sell(input: Game, studioId: string, price: number): Game {
  const card = input.round.onTable;
  if (!card) throw new RuleError('Nobody is on the table.');
  const rs = input.round.studios[studioId];
  if (!rs) throw new RuleError('That studio is not bidding this round.');
  if (slotsLeft(rs) <= 0) throw new RuleError(`${studioById(input, studioId).name} already has five stars.`);
  if (!Number.isInteger(price) || price < RULES.minBid) throw new RuleError(`Minimum bid is $${RULES.minBid}M.`);
  if (price > maxBid(rs)) {
    throw new RuleError(
      `${studioById(input, studioId).name} can bid at most $${maxBid(rs)}M (it must keep $1M for each empty slot).`,
    );
  }
  const g = clone(input);
  const target = g.round.studios[studioId];
  target.cast.push({ ...card, price });
  target.budget -= price;
  g.round.sales.push({ card, studioId, price });
  g.round.onTable = null;
  return g;
}

/** Nobody bit. The card leaves the table for the rest of the round. */
export function bin(input: Game): Game {
  const card = input.round.onTable;
  if (!card) throw new RuleError('Nobody is on the table.');
  const g = clone(input);
  g.round.sales.push({ card, studioId: null, price: 0 });
  g.round.onTable = null;
  return g;
}

/* ------------------------------------------------------------------ */
/*  The trading floor                                                  */
/* ------------------------------------------------------------------ */
export interface TradeTerms {
  a: string;
  b: string;
  aGives: TradeSide;
  bGives: TradeSide;
}

export function validateTrade(g: Game, t: TradeTerms): string | null {
  const A = g.round.studios[t.a];
  const B = g.round.studios[t.b];
  if (!A || !B) return 'Pick two competing studios.';
  if (t.a === t.b) return 'A studio cannot trade with itself.';
  if (A.traded) return `${studioById(g, t.a).name} has already done its deal this round.`;
  if (B.traded) return `${studioById(g, t.b).name} has already done its deal this round.`;

  const sides: [RoundStudio, TradeSide, string][] = [
    [A, t.aGives, t.a],
    [B, t.bGives, t.b],
  ];
  for (const [rs, side, id] of sides) {
    const name = studioById(g, id).name;
    for (const cid of side.cardIds) {
      if (!rs.cast.some((c) => c.id === cid)) return `${name} doesn't own that star.`;
    }
    if (new Set(side.cardIds).size !== side.cardIds.length) return 'Each star can only be traded once.';
    if (!Number.isInteger(side.cash) || side.cash < 0) return 'Cash must be a whole number of millions.';
    if (side.cash > rs.budget) return `${name} only has $${rs.budget}M left this round.`;
    if (!Number.isInteger(side.iou) || side.iou < 0) return 'IOUs must be a whole number of millions.';
  }

  if (t.aGives.cardIds.length + t.bGives.cardIds.length === 0) return 'At least one star has to change hands.';
  if (t.aGives.cardIds.length !== t.bGives.cardIds.length) {
    return 'Both studios must end with five stars, so swap the same number each way.';
  }

  for (const [from, to, side] of [
    [t.a, t.b, t.aGives],
    [t.b, t.a, t.bGives],
  ] as const) {
    if (side.iou === 0) continue;
    const fromName = studioById(g, from).name;
    if (!hasFuturePlay(g, from)) return `${fromName} has no future picture to borrow against.`;
    if (!hasFuturePlay(g, to)) return `${studioById(g, to).name} has no future picture to spend an IOU on.`;
    const total = outstandingDebt(g, from) + side.iou;
    if (total > RULES.maxIouPerStudio) {
      return `${fromName} can owe at most $${RULES.maxIouPerStudio}M against its next picture (already owes $${outstandingDebt(g, from)}M).`;
    }
  }
  return null;
}

export function executeTrade(input: Game, t: TradeTerms): Game {
  const problem = validateTrade(input, t);
  if (problem) throw new RuleError(problem);
  const g = clone(input);
  const A = g.round.studios[t.a];
  const B = g.round.studios[t.b];

  const moveCards = (from: RoundStudio, to: RoundStudio, ids: string[]) => {
    for (const id of ids) {
      const idx = from.cast.findIndex((c) => c.id === id);
      const [card] = from.cast.splice(idx, 1);
      to.cast.push(card);
    }
  };
  moveCards(A, B, t.aGives.cardIds);
  moveCards(B, A, t.bGives.cardIds);

  A.budget += t.bGives.cash - t.aGives.cash;
  B.budget += t.aGives.cash - t.bGives.cash;

  const newIou = (fromId: string, toId: string, amount: number): Iou => ({
    id: uid('iou'),
    round: g.round.number,
    fromId,
    toId,
    amount,
    fromSettled: false,
    toSettled: false,
  });
  if (t.aGives.iou > 0) g.ious.push(newIou(t.a, t.b, t.aGives.iou));
  if (t.bGives.iou > 0) g.ious.push(newIou(t.b, t.a, t.bGives.iou));

  A.traded = true;
  B.traded = true;
  const trade: Trade = { id: uid('trade'), round: g.round.number, ...clone(t) };
  g.round.trades.push(trade);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Pitch, greenlight and the next reel                                */
/* ------------------------------------------------------------------ */
export function nextPitch(input: Game): Game {
  const g = clone(input);
  if (g.round.pitchCursor < g.round.pitchOrder.length - 1) g.round.pitchCursor += 1;
  else g.phase = 'scoring';
  return g;
}

export function setScore(input: Game, studioId: string, cat: ScoreCategory, value: number): Game {
  if (!input.round.scores[studioId]) throw new RuleError('That studio didn’t pitch this reel.');
  const g = clone(input);
  g.round.scores[studioId][cat] = Math.max(0, Math.min(RULES.stampsPerCategory, Math.round(value)));
  return g;
}

/**
 * Locks the Commissioner's cards. Everyone banks their points; the top score is greenlit.
 * A tie at the top needs the Commissioner's casting vote.
 */
export function lockScores(input: Game, castingVote?: string): Game {
  const top = reelLeaders(input);
  let winner = top[0];
  if (top.length > 1) {
    if (!castingVote || !top.includes(castingVote)) throw new RuleError('It’s a tie at the top. The Commissioner needs to give a casting vote.');
    winner = castingVote;
  }
  let g = clone(input);
  for (const rs of playing(g)) g.points[rs.studioId] = (g.points[rs.studioId] ?? 0) + cardTotal(g.round.scores[rs.studioId]);
  g = greenlight(g, winner);
  g.films[g.films.length - 1].score = clone(g.round.scores[winner]);
  g.phase = 'oscar';
  return g;
}

export function setTitle(input: Game, studioId: string, title: string): Game {
  const g = clone(input);
  if (!g.round.studios[studioId]) return input;
  g.round.studios[studioId].title = title;
  return g;
}

export const filmTitle = (g: Game, studioId: string) =>
  g.round.studios[studioId]?.title.trim() || `Untitled ${g.round.genre} Project`;

export function greenlight(input: Game, winnerId: string): Game {
  if (winnerId === input.round.commissionerId) throw new RuleError('The Commissioner cannot greenlight themselves.');
  const rs = input.round.studios[winnerId];
  if (!rs) throw new RuleError('That studio did not pitch this round.');
  if (input.round.winnerId) throw new RuleError('This reel already has a greenlit picture.');
  const g = clone(input);
  const studio = studioById(g, winnerId);
  const film: GreenlitFilm = {
    id: uid('film'),
    gameId: g.id,
    gameDate: g.createdAt,
    round: g.round.number,
    title: filmTitle(g, winnerId),
    logline: '',
    genre: g.round.genre,
    studioId: studio.id,
    studioName: studio.name,
    studioColour: studio.colour,
    commissionerName: commissioner(g).name,
    cast: rs.cast.map((c) => ({ name: c.name, deck: c.deck, price: c.price })),
  };
  g.films.push(film);
  g.round.winnerId = winnerId;
  g.phase = 'ceremony';
  return g;
}

export function editWinningFilm(input: Game, patch: { title?: string; logline?: string }): Game {
  const g = clone(input);
  const film = g.films[g.films.length - 1];
  if (!film || film.round !== g.round.number) return input;
  if (patch.title !== undefined) {
    film.title = patch.title;
    if (g.round.winnerId) g.round.studios[g.round.winnerId].title = patch.title;
  }
  if (patch.logline !== undefined) {
    film.logline = patch.logline;
    g.round.logline = patch.logline;
  }
  return g;
}

export function nextReel(input: Game): Game {
  if (!input.round.winnerId) throw new RuleError('Greenlight a picture first.');
  const next = input.roundIndex + 1;
  if (next >= input.order.length) return { ...input, phase: 'final' };
  return setUpRound(input, next);
}

export function settleTie(input: Game, studioId: string): Game {
  if (!leaders(input).includes(studioId)) throw new RuleError('Only tied studios can win the tie-breaker.');
  return { ...input, tieBreakWinnerId: studioId };
}

export const champion = (g: Game): string | null => {
  const top = leaders(g);
  if (top.length === 1) return top[0];
  return g.tieBreakWinnerId;
};
