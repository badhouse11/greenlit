import { describe, expect, it } from 'vitest';
import {
  RULES,
  cardTotal,
  fireCommissioner,
  foldStudio,
  totalRounds,
  legacyPerReel,
  lockScores,
  nextPitch,
  points,
  reelLeaders,
  setScore,
  bin,
  castingComplete,
  champion,
  createGame,
  draw,
  eligibleBidders,
  executeTrade,
  greenlight,
  leaders,
  maxBid,
  nextBudget,
  nextReel,
  playing,
  sell,
  settleTie,
  setPhase,
  slotsLeft,
  validateTrade,
  TALENT,
  LEGACY,
  GENRES,
} from './engine';
import type { Game } from './types';

const names = ['Badhouse Pictures', 'Moonlight Films', 'Golden Age', 'The Last Take', 'Velvet Rope', 'Kitsch & Co'];
const make = (n: number, order?: number[]) =>
  createGame(
    names.slice(0, n).map((name) => ({ name, colour: 'grenadine' })),
    { directorsCut: false },
    order,
  );

/** Plays a whole casting auction with random but legal bids. */
function castEveryone(g: Game, rng = Math.random): Game {
  let guard = 0;
  while (!castingComplete(g)) {
    if (guard++ > 500) throw new Error('casting never finished');
    g = draw(g);
    if (rng() < 0.08) {
      g = bin(g);
      continue;
    }
    const bidders = eligibleBidders(g);
    const rs = bidders[Math.floor(rng() * bidders.length)];
    const price = 1 + Math.floor(rng() * maxBid(rs));
    g = sell(g, rs.studioId, Math.min(price, maxBid(rs)));
  }
  return setPhase(g, 'reveal');
}

describe('auction rules', () => {
  it('starts every competing studio on $20M and keeps the commissioner out', () => {
    const g = make(4);
    expect(playing(g)).toHaveLength(3);
    expect(g.round.studios[g.round.commissionerId]).toBeUndefined();
    playing(g).forEach((rs) => expect(rs.budget).toBe(RULES.startingBudget));
  });

  it('reserves $1M per empty slot', () => {
    let g = make(3);
    const id = playing(g)[0].studioId;
    expect(maxBid(g.round.studios[id])).toBe(16);
    g = draw(g);
    expect(() => sell(g, id, 17)).toThrow();
    g = sell(g, id, 16);
    const rs = g.round.studios[id];
    expect(rs.budget).toBe(4);
    expect(maxBid(rs)).toBe(1);
    expect(slotsLeft(rs)).toBe(4);
  });

  it('blocks a full roster from buying more', () => {
    let g = make(3);
    const id = playing(g)[0].studioId;
    for (let i = 0; i < 5; i++) g = sell(draw(g), id, 1);
    g = draw(g);
    expect(() => sell(g, id, 1)).toThrow();
  });

  it('cannot reveal until casting is done', () => {
    expect(() => setPhase(make(3), 'reveal')).toThrow();
  });

  it('never deals the same star twice in a round', () => {
    const g = castEveryone(make(8));
    const ids = g.round.sales.map((s) => s.card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the draw', () => {
  it('alternates boy, girl, boy, girl, vault legends included', () => {
    for (let k = 0; k < 20; k++) {
      let g = make(5);
      const genders: string[] = [];
      for (let i = 0; i < 20; i++) {
        g = draw(g);
        genders.push(g.round.onTable!.gender!);
        g = bin(g);
      }
      for (let i = 1; i < genders.length; i++) expect(genders[i] !== genders[i - 1]).toBe(true);
    }
  });

  it('shuffles differently every game', () => {
    const firsts = new Set<string>();
    for (let k = 0; k < 12; k++) firsts.add(draw(make(4)).round.onTable!.id);
    expect(firsts.size > 6).toBe(true);
  });

  it('sends last reel’s stars to the bottom of the deck', () => {
    let g = castEveryone(make(3, [0, 1, 2]));
    const seen = new Set(g.round.sales.map((s) => s.card.id));
    g = nextReel(scoreAndLock(g));
    const top = g.round.talentDeck.slice(0, 60);
    expect(top.some((c) => seen.has(c.id))).toBe(false);
  });
});

describe('gold cards', () => {
  it('marks Oscar winners and keeps the mark through a sale and a fire sale', () => {
    let g = draw(make(4, [0, 1, 2, 3]));
    let guard = 0;
    while (!g.round.onTable?.oscar) {
      if (guard++ > 200) throw new Error('no Oscar winner drawn');
      g = draw(bin(g));
    }
    const id = playing(g)[0].studioId;
    g = sell(g, id, 1);
    expect(g.round.studios[id].cast[0].oscar).toBe(true);
    expect(TALENT.some((c) => c.oscar)).toBe(true);
    expect(TALENT.find((c) => c.name === 'Ryan Gosling')?.oscar).toBeUndefined();
    expect(TALENT.find((c) => c.name === 'Emma Stone')?.oscar).toBe(true);
    expect(LEGACY.find((c) => c.name === 'Audrey Hepburn')?.oscar).toBe(true);
  });

  it('keeps gender and gold on a folded studio’s stars', () => {
    let g = make(5, [0, 1, 2, 3, 4]);
    const star = TALENT.find((c) => c.oscar)!;
    g = { ...g, round: { ...g.round, talentDeck: [star, ...g.round.talentDeck.filter((c) => c.id !== star.id)], nextGender: star.gender } };
    g = sell(draw(g), 's3', 2);
    g = foldStudio(g, 's3');
    expect(g.round.talentDeck[0].oscar).toBe(true);
    expect(g.round.talentDeck[0].gender).toBe(star.gender);
  });
});

describe('the decks', () => {
  it('has no duplicate names or ids, and no Film Noir', () => {
    const all = [...TALENT, ...LEGACY];
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    expect(new Set(all.map((c) => c.name.toLowerCase())).size).toBe(all.length);
    expect(all.every((c) => c.gender === 'f' || c.gender === 'm')).toBe(true);
    expect(GENRES.some((x) => x.name === 'Film Noir')).toBe(false);
  });
});

describe('the vault', () => {
  it('hides a fixed number of legends per reel and always surfaces them', () => {
    for (let n = 3; n <= 8; n++) {
      for (let k = 0; k < 10; k++) {
        const g = castEveryone(make(Math.min(n, 6)));
        const competitors = Math.min(n, 6) - 1;
        const legends = g.round.sales.filter((s) => s.card.deck === 'legacy').length;
        expect(legends).toBe(legacyPerReel(competitors));
        expect(g.round.legacySlots).toHaveLength(legacyPerReel(competitors));
      }
    }
  });
});

/** Pitches, random scores, then the lock. */
function scoreAndLock(g: Game, rng = Math.random): Game {
  g = setPhase(g, 'prep');
  g = setPhase(g, 'pitching');
  while (g.phase === 'pitching') g = nextPitch(g);
  for (const rs of playing(g)) {
    for (const cat of ['casting', 'budget', 'plot'] as const) g = setScore(g, rs.studioId, cat, Math.floor(rng() * 6));
  }
  const top = reelLeaders(g);
  return lockScores(g, top.length > 1 ? top[0] : undefined);
}

describe('loyalty-card scoring', () => {
  it('banks every studio’s points and greenlights the top card', () => {
    let g = castEveryone(make(4));
    g = setPhase(g, 'scoring');
    const [A, B, C] = playing(g).map((r) => r.studioId);
    g = setScore(g, A, 'casting', 5);
    g = setScore(g, A, 'plot', 2);
    g = setScore(g, B, 'budget', 4);
    g = setScore(g, C, 'plot', 9); // clamps to 5
    expect(cardTotal(g.round.scores[C])).toBe(5);
    g = lockScores(g);
    expect(g.phase).toBe('oscar');
    expect(g.round.winnerId).toBe(A);
    expect(points(g, A)).toBe(7);
    expect(points(g, B)).toBe(4);
    expect(points(g, C)).toBe(5);
    expect(g.films[0].score?.casting).toBe(5);
  });

  it('demands a casting vote on a tie', () => {
    let g = castEveryone(make(3));
    const [A, B] = playing(g).map((r) => r.studioId);
    g = setScore(g, A, 'plot', 3);
    g = setScore(g, B, 'plot', 3);
    expect(() => lockScores(g)).toThrow();
    expect(lockScores(g, B).round.winnerId).toBe(B);
  });
});

describe('trading floor and IOUs', () => {
  it('swaps stars, moves cash and carries an IOU into the next picture', () => {
    // order: s1 commissions round 1, s2 round 2, s3 round 3
    let g = castEveryone(make(3, [0, 1, 2]));
    const [A, B] = playing(g); // s2, s3
    const terms = {
      a: A.studioId,
      b: B.studioId,
      aGives: { cardIds: [A.cast[0].id], cash: 0, iou: 4 },
      bGives: { cardIds: [B.cast[0].id], cash: 0, iou: 0 },
    };
    expect(validateTrade(g, terms)).toBeNull();
    g = executeTrade(g, terms);
    expect(g.round.studios[A.studioId].cast).toHaveLength(5);
    expect(g.round.studios[A.studioId].cast.some((c) => c.id === B.cast[0].id)).toBe(true);
    expect(nextBudget(g, A.studioId)).toBe(16);
    expect(nextBudget(g, B.studioId)).toBe(24);

    // one trade each
    const again = { ...terms };
    expect(validateTrade(g, again)).not.toBeNull();

    g = nextReel(greenlight(g, A.studioId));
    // round 2: s2 commissions, so only s1 and s3 compete. s3 collects its $4M.
    expect(g.round.studios[B.studioId].budget).toBe(24);
    // s2's debt waits for round 3, when it competes again
    g = nextReel(greenlight(castEveryone(g), B.studioId));
    expect(g.round.studios[A.studioId].budget).toBe(16);
  });

  it('needs equal swaps so everyone keeps five', () => {
    const g = castEveryone(make(4));
    const [A, B] = playing(g);
    expect(
      validateTrade(g, {
        a: A.studioId,
        b: B.studioId,
        aGives: { cardIds: [A.cast[0].id, A.cast[1].id], cash: 0, iou: 0 },
        bGives: { cardIds: [B.cast[0].id], cash: 0, iou: 0 },
      }),
    ).toMatch(/same number/);
  });

  it('caps IOUs at $15M and bans them with no future picture', () => {
    let g = castEveryone(make(3, [0, 1, 2]));
    const [A, B] = playing(g);
    expect(
      validateTrade(g, {
        a: A.studioId,
        b: B.studioId,
        aGives: { cardIds: [A.cast[0].id], cash: 0, iou: 16 },
        bGives: { cardIds: [B.cast[0].id], cash: 0, iou: 0 },
      }),
    ).toMatch(/at most/);
    // jump to the final reel
    g = nextReel(greenlight(g, A.studioId));
    g = nextReel(greenlight(castEveryone(g), playing(g)[0].studioId));
    g = castEveryone(g);
    const [C, D] = playing(g);
    expect(
      validateTrade(g, {
        a: C.studioId,
        b: D.studioId,
        aGives: { cardIds: [C.cast[0].id], cash: 0, iou: 1 },
        bGives: { cardIds: [D.cast[0].id], cash: 0, iou: 0 },
      }),
    ).toMatch(/no future/);
  });
});

describe('a whole game', () => {
  it('rotates the commissioner once each and crowns a champion', () => {
    for (let n = 3; n <= 6; n++) {
      let g = make(n);
      const seen: string[] = [];
      for (let r = 0; r < n; r++) {
        seen.push(g.round.commissionerId);
        g = castEveryone(g);
        expect(() => greenlight(g, g.round.commissionerId)).toThrow();
        g = nextReel(scoreAndLock(g));
      }
      expect(g.phase).toBe('final');
      expect(new Set(seen).size).toBe(n);
      expect(g.films).toHaveLength(n);
      const top = leaders(g);
      if (top.length > 1) {
        expect(champion(g)).toBeNull();
        g = settleTie(g, top[0]);
      }
      expect(champion(g)).not.toBeNull();
    }
  });
});

describe('studios leaving', () => {
  it('folds a studio mid-casting: fire sale, frozen points, no future turn', () => {
    let g = make(5, [0, 1, 2, 3, 4]);
    g = draw(g);
    const leaving = 's3';
    g = sell(g, leaving, 2);
    const star = g.round.studios[leaving].cast[0];
    g = foldStudio(g, leaving);
    expect(g.round.studios[leaving]).toBeUndefined();
    expect(g.round.talentDeck[0].id === star.id || g.round.legacyDeck[0].id === star.id).toBe(true);
    expect(g.order.includes(leaving)).toBe(false);
    expect(totalRounds(g)).toBe(4);
    g = castEveryone(g);
    expect(playing(g)).toHaveLength(3);
  });

  it('fires the Commissioner: next on the rota takes the chair and the genre is redrawn', () => {
    let g = castEveryone(make(5, [0, 1, 2, 3, 4]));
    expect(g.round.commissionerId).toBe('s1');
    g = fireCommissioner(g);
    expect(g.round.commissionerId).toBe('s2');
    expect(g.round.studios['s2']).toBeUndefined();
    expect(g.order.filter((x) => x === 's2')).toHaveLength(1);
    expect(g.order.includes('s1')).toBe(false);
    expect(playing(g)).toHaveLength(3);
    g = castEveryone(g);
    g = nextReel(scoreAndLock(g));
    expect(g.round.commissionerId).toBe('s3');
  });

  it('ends the game when too few studios remain', () => {
    let g = make(3, [0, 1, 2]);
    g = foldStudio(g, 's2');
    expect(g.phase).toBe('final');
  });
});
