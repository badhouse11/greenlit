import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { Game, TradeSide } from '../game/types';
import type { Act, Toast } from '../App';
import {
  RULES,
  bin,
  cardTotal,
  legendsLeft,
  lockScores,
  maxReelScore,
  nextPitch,
  points,
  reelLeaders,
  setScore,
  castingComplete,
  champion,
  commissioner,
  draw,
  editWinningFilm,
  eligibleBidders,
  executeTrade,
  filmTitle,
  hasFuturePlay,
  isFinalRound,
  leaders,
  maxBid,
  nextBudget,
  nextReel,
  outstandingDebt,
  playing,
  sell,
  setPhase,
  setTitle,
  settleTie,
  standings,
  studioById,
  tokens,
  totalRounds,
  validateTrade,
} from '../game/engine';
import { FilmTicket, LoyaltyCard, Sleeve, StarTicket, Stepper, StudioStub, TokenRow } from '../components/Cards';
import { Ticket } from '../components/Ticket';
import { stock } from '../lib/palette';
import { CAN_DOWNLOAD, downloadFilmTicket } from '../lib/exportTicket';
import { ShopStrip } from '../components/ShopStrip';

interface PlayProps {
  game: Game;
  act: Act;
  say: (t: Toast) => void;
  onEnd: () => void;
  onArchive: () => void;
}

export function Play(props: PlayProps) {
  switch (props.game.phase) {
    case 'handover':
      return <Handover {...props} />;
    case 'commission':
      return <Commission {...props} />;
    case 'casting':
      return <Casting {...props} />;
    case 'reveal':
      return <Reveal {...props} />;
    case 'trading':
      return <Trading {...props} />;
    case 'prep':
      return <Prep {...props} />;
    case 'pitching':
      return <Pitching {...props} />;
    case 'scoring':
      return <Scoring {...props} />;
    case 'oscar':
      return <Oscar {...props} />;
    case 'ceremony':
      return <Ceremony {...props} />;
    case 'final':
      return <Final {...props} />;
    default:
      return <Handover {...props} />;
  }
}

/* ====================================================================== */
/*  Handover: pass the device to the Commissioner                          */
/* ====================================================================== */
function Handover({ game, act }: PlayProps) {
  const boss = commissioner(game);
  const s = stock(boss.colour);
  const adjusted = playing(game).filter((rs) => rs.startBudget !== RULES.startingBudget);
  return (
    <>
    <ShopStrip />
    <main className="page page--narrow centre-stack">
      <div className="t-wide">
        Reel {game.round.number} of {totalRounds(game)}
      </div>
      <p className="lede">Pass the device to this reel’s Commissioner. Everyone else, eyes on your drinks.</p>
      <div className="handover-label t-wide">This reel’s Commissioner</div>
      <div className="handover-name t-ticket" style={{ color: s.bg }}>
        {boss.name}
      </div>
      <button className="btn btn--big" onClick={() => act((g) => setPhase(g, 'commission'))}>
        I’m the Commissioner. Show me the commission
      </button>

      {adjusted.length > 0 && (
        <Ticket className="stub" bg="#F4E7CE" wrapClassName="" style={{ width: 'min(520px, 100%)', textAlign: 'left' }}>
          <h2 className="t-ticket" style={{ fontSize: '1.4rem' }}>
            Debts called in
          </h2>
          <ul className="settle-list">
            {adjusted.map((rs) => {
              const diff = rs.startBudget - RULES.startingBudget;
              return (
                <li key={rs.studioId}>
                  <strong>{studioById(game, rs.studioId).name}</strong> starts on ${rs.startBudget}M ({diff > 0 ? `+$${diff}M owed to them` : `−$${-diff}M paid back`}).
                </li>
              );
            })}
          </ul>
        </Ticket>
      )}

      {game.roundIndex > 0 && <MiniStandings game={game} />}
    </main>
    </>
  );
}

function MiniStandings({ game, title = 'The board so far' }: { game: Game; title?: string }) {
  return (
    <section style={{ width: 'min(620px, 100%)', textAlign: 'left' }} aria-labelledby="standings-h">
      <h2 id="standings-h" className="t-ticket" style={{ fontSize: '1.6rem', marginBottom: 10 }}>
        {title}
      </h2>
      <div className="standings">
        {standings(game).map((row, i) => {
          const s = stock(row.studio.colour);
          return (
            <Ticket key={row.studio.id} bg={s.bg} ink={s.ink} className="standing" serrated>
              <span className="standing__place">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="standing__name t-ticket">{row.studio.name}</span>
                <TokenRow count={row.tokens} />
              </span>
              <span className="standing__score">
                {row.points}
                <small> pts</small>
              </span>
            </Ticket>
          );
        })}
      </div>
    </section>
  );
}

/* ====================================================================== */
/*  Commission: the Commissioner reads the secret genre                    */
/* ====================================================================== */
function usePeek() {
  const [peeking, setPeeking] = useState(false);
  const [seen, setSeen] = useState(false);
  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setPeeking(true);
      setSeen(true);
    },
    onPointerUp: () => setPeeking(false),
    onPointerCancel: () => setPeeking(false),
    onPointerLeave: () => setPeeking(false),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setPeeking(true);
        setSeen(true);
      }
    },
    onKeyUp: () => setPeeking(false),
    onBlur: () => setPeeking(false),
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
  return { peeking, seen, handlers };
}

function Commission({ game, act }: PlayProps) {
  const boss = commissioner(game);
  const { peeking, seen, handlers } = usePeek();
  return (
    <main className="page page--narrow centre-stack">
      <h1 className="page-title t-ticket">Your commission, {boss.name}</h1>
      <p className="lede">Press and hold to slide the card out. Read it, remember it, keep a straight face. Let go and it goes back in the sleeve.</p>
      <Sleeve genre={game.round.genre} showGenre={peeking} peeking={peeking} reel={game.round.number} commissionerName={boss.name} />
      <button className="btn btn--big btn--hot peek-btn" {...handlers}>
        {peeking ? 'Reading…' : 'Hold to read the commission'}
      </button>
      <button className="btn btn--big" disabled={!seen} onClick={() => act((g) => setPhase(g, 'casting'))}>
        Seal it. Start the casting auction
      </button>
      {!seen && <p className="muted">Read the commission once before casting begins.</p>}
    </main>
  );
}

/* ====================================================================== */
/*  Casting auction                                                        */
/* ====================================================================== */
function Casting({ game, act, say }: PlayProps) {
  const { round } = game;
  const card = round.onTable;
  const bidders = eligibleBidders(game);
  const [buyer, setBuyer] = useState<string | null>(null);
  const [price, setPrice] = useState(1);
  const { peeking, handlers } = usePeek();
  const done = castingComplete(game);

  const stageRef = useRef<HTMLElement>(null);

  // Clear the slip whenever a new star hits the table, and on a phone bring the card into view.
  useEffect(() => {
    setBuyer(null);
    setPrice(1);
    if (card && window.innerWidth < 600) stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [card?.id]);

  const buyerRs = buyer ? round.studios[buyer] : null;
  const limit = buyerRs ? maxBid(buyerRs) : 1;
  const sold = round.sales.filter((s) => s.studioId).length;

  const pick = (id: string) => {
    if (!card) return;
    const rs = round.studios[id];
    if (!rs || rs.cast.length >= RULES.castSize) return;
    setBuyer(id);
    setPrice((p) => Math.min(Math.max(1, p), maxBid(rs)));
  };

  const confirmSale = () => {
    if (!buyer || !card) return;
    const name = studioById(game, buyer).name;
    act((g) => sell(g, buyer, price), { note: `Sold. ${card.name} signs with ${name} for $${price}M.` });
  };

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title t-ticket">Casting auction</h1>
          <p className="lede">
            Draw a star, take bids out loud in $1M steps, then log who won. {sold} {sold === 1 ? 'star' : 'stars'} signed so far.
          </p>
        </div>
        <button className="btn btn--ghost btn--small" {...handlers} aria-label="Commissioner only: hold to see the genre">
          {peeking ? `Genre: ${round.genre}` : 'Commissioner’s peek (hold)'}
        </button>
      </div>

      <div className="casting">
        <section className="casting__stage" aria-label="The table" ref={stageRef}>
          {card ? (
            <div className={card.deck === 'legacy' ? 'vault-surprise' : 'slide-in'} key={card.id}>
              {card.deck === 'legacy' && <div className="vault-banner t-wide">From the vault</div>}
              <StarTicket card={card} />
            </div>
          ) : (
            <div className="casting__empty">
              {done ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <strong className="t-ticket" style={{ fontSize: '2rem' }}>
                    That’s a wrap on casting
                  </strong>
                  <span>Every studio has five stars.</span>
                </div>
              ) : (
                <span>The table is empty. Draw the next star. Somewhere in this deck, a legend is waiting.</span>
              )}
            </div>
          )}

          {!done && (
            <div className="deck-buttons">
              <button
                className="deck-btn"
                disabled={!!card}
                onClick={() =>
                  act((g) => {
                    const next = draw(g);
                    if (next.round.onTable?.deck === 'legacy') say({ text: `The vault opens. ${next.round.onTable.name} is in the room.` });
                    return next;
                  })
                }
              >
                <strong>Draw the next star</strong>
                <small>{round.talentDeck.length} living stars in the deck</small>
              </button>
              <div className="vault-teaser" aria-live="polite">
                <strong className="t-ticket">{legendsLeft(game)}</strong>
                <small>{legendsLeft(game) === 1 ? 'legend still hidden' : 'legends still hidden'} in this reel</small>
              </div>
            </div>
          )}

          {done && (
            <button className="btn btn--big btn--hot" onClick={() => act((g) => setPhase(g, 'reveal'))}>
              Open the envelope
            </button>
          )}
        </section>

        <section style={{ display: 'grid', gap: 22 }}>
          {card && (
            <div className="form-sheet sale-slip" aria-labelledby="slip-h">
              <h2 id="slip-h" className="form-sheet__title t-ticket" style={{ margin: 0 }}>
                Bill of sale: {card.name}
              </h2>
              <p className="muted" style={{ fontSize: '0.95rem' }}>
                Tap the studio that won it, set the fee, then sign it off.
              </p>
              <div className="field">
                <span>Sold to</span>
                <div className="picker" role="group" aria-label="Winning studio">
                  {bidders.map((rs) => {
                    const st = studioById(game, rs.studioId);
                    const sk = stock(st.colour);
                    return (
                      <button
                        key={rs.studioId}
                        className="chip chip--studio"
                        style={{ ['--chip-bg' as string]: sk.bg, ['--chip-ink' as string]: sk.ink }}
                        aria-pressed={buyer === rs.studioId}
                        onClick={() => pick(rs.studioId)}
                      >
                        {st.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="sale-slip__row">
                <div className="field">
                  <span>Fee</span>
                  <Stepper value={price} min={1} max={limit} onChange={setPrice} label="fee" disabled={!buyer} />
                </div>
              </div>
              {buyerRs && <div className="sale-slip__limit">This studio can go as high as ${limit}M and still afford a full cast.</div>}
              <div className="btn-row">
                <button className="btn btn--go btn--big" disabled={!buyer} onClick={confirmSale}>
                  Sold for ${price}M
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => act((g) => bin(g), { note: `No takers. ${card.name} goes back to their trailer.` })}
                >
                  No takers. Bin the card
                </button>
              </div>
            </div>
          )}

          {!card && !done && bidders.length === 1 && (
            <div className="notice">
              Only {studioById(game, bidders[0].studioId).name} is still casting. Every star they draw is theirs for $1M unless they want to pay more.
            </div>
          )}

          <div className="ledger" role="group" aria-label="Studios">
            {playing(game).map((rs) => {
              const studio = studioById(game, rs.studioId);
              const full = rs.cast.length >= RULES.castSize;
              return (
                <button
                  key={rs.studioId}
                  className="stub-btn"
                  aria-pressed={buyer === rs.studioId}
                  aria-disabled={!card || full}
                  onClick={() => {
                    if (!card) return say({ text: 'Draw a star first, then tap the studio that won it.' });
                    if (full) return say({ text: `${studio.name} already has five stars.`, error: true });
                    pick(rs.studioId);
                  }}
                >
                  <StudioStub studio={studio} rs={rs} tokens={tokens(game, studio.id)} />
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

/* ====================================================================== */
/*  The reveal                                                             */
/* ====================================================================== */
function Reveal({ game, act }: PlayProps) {
  const [open, setOpen] = useState(false);
  const boss = commissioner(game);
  return (
    <div className={`reveal ${open ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label="The genre reveal">
      <div className="reveal__inner">
        <div className="reveal__kicker t-wide" aria-hidden={!open}>
          Your next picture is…
        </div>
        <Sleeve genre={game.round.genre} showGenre={open} peeking={false} reel={game.round.number} commissionerName={boss.name} />
        {!open ? (
          <div style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
            <p style={{ opacity: 0.8 }}>Casting is closed. {boss.name}, the floor is yours.</p>
            <button className="btn btn--big btn--hot" onClick={() => setOpen(true)} autoFocus>
              Open the envelope
            </button>
          </div>
        ) : (
          <div className="reveal__after" style={{ display: 'grid', gap: 16, justifyItems: 'center' }}>
            <p style={{ opacity: 0.85 }}>You have your cast. Now make the film.</p>
            <button className="btn btn--big" style={{ ['--b-bg' as string]: '#F4E7CE', ['--b-ink' as string]: '#1D1814' }} onClick={() => act((g) => setPhase(g, 'trading'))}>
              Open the trading floor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  Trading floor                                                          */
/* ====================================================================== */
const emptySide = (): TradeSide => ({ cardIds: [], cash: 0, iou: 0 });

function Trading({ game, act }: PlayProps) {
  const players = playing(game);
  const open = players.filter((rs) => !rs.traded);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [aGives, setAGives] = useState<TradeSide>(emptySide);
  const [bGives, setBGives] = useState<TradeSide>(emptySide);
  const [signed, setSigned] = useState<[boolean, boolean]>([false, false]);

  const reset = () => {
    setA(null);
    setB(null);
    setAGives(emptySide());
    setBGives(emptySide());
    setSigned([false, false]);
  };

  const terms = a && b ? { a, b, aGives, bGives } : null;
  const problem = terms ? validateTrade(game, terms) : null;
  const touched = aGives.cardIds.length + bGives.cardIds.length > 0;

  // Changing the terms voids any signatures.
  useEffect(() => setSigned([false, false]), [a, b, aGives, bGives]);

  const close = () => {
    if (!terms) return;
    const ok = act((g) => executeTrade(g, terms), {
      note: `Deal done. ${studioById(game, terms.a).name} and ${studioById(game, terms.b).name} shake on it.`,
    });
    if (ok) reset();
  };

  const side = (who: 'a' | 'b') => {
    const id = who === 'a' ? a : b;
    const other = who === 'a' ? b : a;
    const setId = who === 'a' ? setA : setB;
    const gives = who === 'a' ? aGives : bGives;
    const setGives = who === 'a' ? setAGives : setBGives;
    const rs = id ? game.round.studios[id] : null;
    const iouRoom = id ? RULES.maxIouPerStudio - outstandingDebt(game, id) : 0;
    const canIou = !!id && !!other && hasFuturePlay(game, id) && hasFuturePlay(game, other);
    return (
      <section className="form-sheet trade-side" aria-label={who === 'a' ? 'First studio' : 'Second studio'}>
        <h2 className="t-ticket" style={{ fontSize: '1.5rem' }}>
          {id ? studioById(game, id).name : who === 'a' ? 'First studio' : 'Second studio'}
        </h2>
        <div className="picker" role="group" aria-label="Choose studio">
          {players.map((p) => (
            <button
              key={p.studioId}
              className="chip"
              aria-pressed={id === p.studioId}
              disabled={p.traded || p.studioId === other}
              onClick={() => {
                setId(id === p.studioId ? null : p.studioId);
                setGives(emptySide());
              }}
            >
              {studioById(game, p.studioId).name}
            </button>
          ))}
        </div>
        {rs && (
          <>
            <div>
              <div className="field" style={{ marginBottom: 6 }}>
                <span>Stars they give up</span>
              </div>
              <ul className="give-list">
                {rs.cast.map((c) => {
                  const checked = gives.cardIds.includes(c.id);
                  return (
                    <li key={c.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setGives({
                              ...gives,
                              cardIds: checked ? gives.cardIds.filter((x) => x !== c.id) : [...gives.cardIds, c.id],
                            })
                          }
                        />
                        <span>
                          {c.name}
                          {c.deck === 'legacy' ? ' ★' : ''}
                        </span>
                        <span className="muted">${c.price}M</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="money-row">
              <div className="field">
                <span>
                  Cash now <small>(has ${rs.budget}M)</small>
                </span>
                <Stepper small value={gives.cash} min={0} max={rs.budget} onChange={(n) => setGives({ ...gives, cash: n })} label="cash now" />
              </div>
              <div className="field">
                <span>
                  IOU from next picture <small>{canIou ? `(up to $${iouRoom}M)` : '(no next picture)'}</small>
                </span>
                <Stepper
                  small
                  value={gives.iou}
                  min={0}
                  max={canIou ? Math.max(0, iouRoom) : 0}
                  onChange={(n) => setGives({ ...gives, iou: n })}
                  label="IOU"
                  disabled={!canIou}
                />
              </div>
            </div>
          </>
        )}
      </section>
    );
  };

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title t-ticket">The trading floor</h1>
          <p className="lede">
            The genre is <strong>{game.round.genre}</strong>. Each studio gets one deal: swap stars, sweeten it with cash, or borrow against your next picture. Deals are optional.
          </p>
        </div>
        <button className="btn btn--go btn--big" onClick={() => act((g) => setPhase(g, 'prep'))}>
          Close the trading floor
        </button>
      </div>

      {open.length >= 2 ? (
        <>
          <div className="trade">
            {side('a')}
            <div className="trade__swap" aria-hidden="true">
              ⇄
            </div>
            {side('b')}
          </div>

          {terms && (
            <div className="form-sheet" style={{ marginTop: 22, display: 'grid', gap: 14 }}>
              <h2 className="t-ticket" style={{ fontSize: '1.5rem' }}>
                Deal memo
              </h2>
              {touched && problem ? (
                <div className="notice notice--error" role="alert">
                  {problem}
                </div>
              ) : !touched ? (
                <p className="muted">Tick the stars changing hands. Both studios must finish with five.</p>
              ) : (
                <>
                  <p>
                    <strong>{studioById(game, terms.a).name}</strong> gives {describe(game, terms.a, aGives)}. <strong>{studioById(game, terms.b).name}</strong> gives{' '}
                    {describe(game, terms.b, bGives)}.
                  </p>
                  {(aGives.iou > 0 || bGives.iou > 0) && (
                    <p className="muted">
                      {aGives.iou > 0 && `${studioById(game, terms.a).name} will start its next picture on $${nextBudget(game, terms.a) - aGives.iou + bGives.iou}M. `}
                      {bGives.iou > 0 && `${studioById(game, terms.b).name} will start its next picture on $${nextBudget(game, terms.b) - bGives.iou + aGives.iou}M.`}
                    </p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    {[terms.a, terms.b].map((id, i) => (
                      <label key={id} className="signature">
                        <input type="checkbox" checked={signed[i]} onChange={(e) => setSigned(i === 0 ? [e.target.checked, signed[1]] : [signed[0], e.target.checked])} />
                        {signed[i] ? <span className="scrawl">{studioById(game, id).name}</span> : <span>Signed for {studioById(game, id).name}</span>}
                      </label>
                    ))}
                  </div>
                  <div className="btn-row">
                    <button className="btn btn--go" disabled={!signed[0] || !signed[1]} onClick={close}>
                      Shake on it
                    </button>
                    <button className="btn btn--ghost" onClick={reset}>
                      Tear up the memo
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="notice">Every studio that can deal has dealt. Close the trading floor when you’re ready to pitch.</div>
      )}

      {game.round.trades.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 className="t-ticket" style={{ fontSize: '1.6rem', marginBottom: 12 }}>
            Deals done this reel
          </h2>
          <div className="memo-list">
            {game.round.trades.map((t) => (
              <Ticket key={t.id} className="memo" serrated bg="#F4E7CE">
                <strong>{studioById(game, t.a).name}</strong> gave {describeDone(game, t.aGives, t.round)}. <strong>{studioById(game, t.b).name}</strong> gave{' '}
                {describeDone(game, t.bGives, t.round)}.
              </Ticket>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 32 }}>
        <h2 className="t-ticket" style={{ fontSize: '1.6rem', marginBottom: 12 }}>
          Current casts
        </h2>
        <div className="ledger">
          {players.map((rs) => (
            <StudioStub key={rs.studioId} studio={studioById(game, rs.studioId)} rs={rs} badge={rs.traded ? 'Dealt' : undefined} />
          ))}
        </div>
      </section>
    </main>
  );
}

function describe(game: Game, id: string, s: TradeSide) {
  const rs = game.round.studios[id];
  const names = s.cardIds.map((cid) => rs.cast.find((c) => c.id === cid)?.name).filter(Boolean);
  const parts = [...names];
  if (s.cash) parts.push(`$${s.cash}M cash`);
  if (s.iou) parts.push(`a $${s.iou}M IOU`);
  return parts.length ? parts.join(' + ') : 'nothing';
}

function describeDone(game: Game, s: TradeSide, round: number) {
  const names = s.cardIds.map((cid) => {
    for (const rs of Object.values(game.round.studios)) {
      const c = rs.cast.find((x) => x.id === cid);
      if (c) return c.name;
    }
    return cid;
  });
  const parts = [...names];
  if (s.cash) parts.push(`$${s.cash}M cash`);
  if (s.iou) parts.push(`a $${s.iou}M IOU (from reel ${round})`);
  return parts.length ? parts.join(' + ') : 'nothing';
}

/* ====================================================================== */
/*  Get your pitches ready                                                 */
/* ====================================================================== */
const PROMPTS = [
  { head: 'A title', body: 'Say it like it’s already on the poster.' },
  { head: 'A logline', body: 'One sentence: who wants what, and what’s standing in the way.' },
  { head: 'All five stars', body: 'Who’s the lead? Who’s the villain? Who dies in the first ten minutes?' },
  { head: 'Own the genre', body: 'However wrong your cast is for it. Especially then.' },
  { head: 'The money shot', body: 'The one scene the trailer is built around.' },
  { head: 'The budget', body: 'Came in under? Brag about it. The Commissioner is counting.' },
];

function Prep({ game, act }: PlayProps) {
  const boss = commissioner(game);
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title t-ticket">Get your pitches ready</h1>
          <p className="lede">
            You’re making a <strong>{game.round.genre.toLowerCase()}</strong>. Each studio gets {RULES.pitchSeconds / 60} minutes on the clock. {boss.name} scores casting, budget and plot.
          </p>
        </div>
      </div>

      <div className="prep">
        <ol className="prompt-list">
          {PROMPTS.map((p) => (
            <li key={p.head}>
              <Ticket className="prompt" serrated bg="#F4E7CE">
                <strong className="t-ticket">{p.head}</strong>
                <span>{p.body}</span>
              </Ticket>
            </li>
          ))}
        </ol>

        <aside className="form-sheet prep__order">
          <h2 className="t-ticket" style={{ fontSize: '1.5rem' }}>
            Running order
          </h2>
          <ol className="order-list">
            {game.round.pitchOrder.map((id, i) => {
              const st = studioById(game, id);
              return (
                <li key={id}>
                  <span className="t-mono">{ordinal(i + 1)}</span>
                  <span>
                    <span className="dot" style={{ background: stock(st.colour).bg }} />
                    {st.name}
                  </span>
                </li>
              );
            })}
          </ol>
          <button className="btn btn--big btn--hot" onClick={() => act((g) => setPhase(g, 'pitching'))}>
            Lights. Camera. First pitch
          </button>
        </aside>
      </div>
    </main>
  );
}

/* ====================================================================== */
/*  The pitches: two minutes each, on the clock                            */
/* ====================================================================== */
function useCountdown(total: number, resetKey: unknown) {
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    setLeft(total);
    setRunning(false);
  }, [total, resetKey]);

  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + left * 1000;
    const t = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) setRunning(false);
    }, 200);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Keep the screen awake while the clock runs, where the device allows it.
  useEffect(() => {
    if (!running) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => {
      lock?.release().catch(() => undefined);
    };
  }, [running]);

  return {
    left,
    running,
    start: () => left > 0 && setRunning(true),
    pause: () => setRunning(false),
    reset: () => {
      setRunning(false);
      setLeft(total);
    },
  };
}

function Pitching({ game, act }: PlayProps) {
  const { round } = game;
  const id = round.pitchOrder[round.pitchCursor];
  const rs = round.studios[id];
  const studio = studioById(game, id);
  const s = stock(studio.colour);
  const clock = useCountdown(RULES.pitchSeconds, id);
  const last = round.pitchCursor === round.pitchOrder.length - 1;
  const mm = Math.floor(clock.left / 60);
  const ss = String(clock.left % 60).padStart(2, '0');
  const over = clock.left === 0;
  const urgent = clock.left <= 15 && !over;

  return (
    <main className="page page--narrow centre-stack pitching">
      <div className="t-wide">
        Pitch {round.pitchCursor + 1} of {round.pitchOrder.length} · {round.genre}
      </div>
      <Ticket bg={s.bg} ink={s.ink} className="clock-ticket">
        <div className="clock-ticket__studio t-ticket">{studio.name}</div>
        <div className={`clock ${urgent ? 'is-urgent' : ''} ${over ? 'is-over' : ''}`} role="timer" aria-live="off">
          {over ? 'Cut!' : `${mm}:${ss}`}
        </div>
        <div className="clock-bar" aria-hidden="true">
          <span style={{ width: `${(clock.left / RULES.pitchSeconds) * 100}%` }} />
        </div>
        <label className="clock-ticket__title">
          <span className="visually-hidden">Film title for {studio.name}</span>
          <input
            id={`title-${id}`}
            className="input input--line"
            placeholder="Working title"
            value={rs.title}
            maxLength={60}
            onChange={(e) => act((g) => setTitle(g, id, e.target.value), { undoable: false })}
          />
        </label>
        <div className="cast-line clock-ticket__cast">
          {rs.cast.map((c) => (
            <span key={c.id}>
              {c.name}
              {c.deck === 'legacy' ? ' ★' : ''}
            </span>
          ))}
        </div>
      </Ticket>

      <div className="btn-row" style={{ justifyContent: 'center' }}>
        {!over &&
          (clock.running ? (
            <button className="btn btn--big btn--ghost" onClick={clock.pause}>
              Pause the clock
            </button>
          ) : (
            <button className="btn btn--big btn--hot" onClick={clock.start}>
              {clock.left === RULES.pitchSeconds ? 'Start the clock' : 'Resume'}
            </button>
          ))}
        <button className={`btn btn--big ${over ? 'btn--go' : 'btn--ghost'}`} onClick={() => act((g) => nextPitch(g))}>
          {last ? 'That’s all the pitches' : 'Next studio'}
        </button>
      </div>
      {clock.left !== RULES.pitchSeconds && (
        <button className="link-btn" onClick={clock.reset}>
          Restart this studio’s clock
        </button>
      )}
    </main>
  );
}

/* ====================================================================== */
/*  Scoring: the Commissioner punches loyalty cards in private             */
/* ====================================================================== */
function Scoring({ game, act }: PlayProps) {
  const boss = commissioner(game);
  const [unlocked, setUnlocked] = useState(false);
  const [vote, setVote] = useState<string | null>(null);
  const top = reelLeaders(game);
  const anyScored = Object.values(game.round.scores).some((c) => cardTotal(c) > 0);
  const tie = anyScored && top.length > 1;

  if (!unlocked) {
    return (
      <main className="page page--narrow centre-stack">
        <div className="t-wide">Scores in private</div>
        <p className="lede">Hand the device to the Commissioner. Everyone else, eyes on the ceiling.</p>
        <div className="handover-label t-wide">This reel’s Commissioner</div>
        <div className="handover-name t-ticket" style={{ color: stock(boss.colour).bg }}>
          {boss.name}
        </div>
        <button className="btn btn--big" onClick={() => setUnlocked(true)}>
          I’m the Commissioner. Open my scorecards
        </button>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title t-ticket">Punch the cards</h1>
          <p className="lede">
            Up to {RULES.stampsPerCategory} stamps each for casting, budget and plot. Tap a stamp to punch it, tap it again to take it back. Nobody sees these until the envelope.
          </p>
        </div>
      </div>

      <div className="loyalty-grid">
        {game.round.pitchOrder.map((id) => (
          <LoyaltyCard
            key={id}
            studio={studioById(game, id)}
            title={filmTitle(game, id)}
            rs={game.round.studios[id]}
            card={game.round.scores[id]}
            onPunch={(cat, value) => act((g) => setScore(g, id, cat, value), { undoable: false })}
          />
        ))}
      </div>

      <div className="form-sheet lock-panel">
        {tie ? (
          <>
            <p>
              <strong>Dead heat on {cardTotal(game.round.scores[top[0]])}.</strong> Give your casting vote. That studio takes the Oscar; everyone still keeps their points.
            </p>
            <div className="picker" role="group" aria-label="Casting vote">
              {top.map((id) => (
                <button key={id} className="chip" aria-pressed={vote === id} onClick={() => setVote(id)}>
                  {studioById(game, id).name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">{anyScored ? 'Happy with your stamps? Seal the envelope.' : 'Punch at least one stamp before sealing the envelope.'}</p>
        )}
        <button
          className="btn btn--big btn--go"
          disabled={!anyScored || (tie && !vote)}
          onClick={() => act((g) => lockScores(g, tie ? vote ?? undefined : undefined))}
        >
          Seal the envelope
        </button>
      </div>
    </main>
  );
}

/* ====================================================================== */
/*  The Oscar: phone on the table, the big reveal                          */
/* ====================================================================== */
function Oscar({ game, act }: PlayProps) {
  const [stage, setStage] = useState<'table' | 'drumroll' | 'winner'>('table');
  const film = game.films[game.films.length - 1];
  const winner = studioById(game, film.studioId);

  useEffect(() => {
    if (stage !== 'drumroll') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setStage('winner'), reduce ? 600 : 3400);
    return () => window.clearTimeout(t);
  }, [stage]);

  return (
    <div className={`oscar oscar--${stage}`} role="dialog" aria-modal="true" aria-label="The Oscar">
      <div className="oscar__inner">
        {stage === 'table' && (
          <>
            <div className="t-wide oscar__kicker">Reel {game.round.number} · {game.round.genre}</div>
            <p className="oscar__line t-ticket">Commissioner, put the phone on the table.</p>
            <p className="oscar__sub">Everyone gather round. Somebody do a drumroll.</p>
            <button className="btn btn--big oscar__btn" onClick={() => setStage('drumroll')} autoFocus>
              Open the envelope
            </button>
          </>
        )}
        {stage === 'drumroll' && (
          <>
            <p className="oscar__line t-ticket">And the Oscar goes to</p>
            <div className="oscar__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </>
        )}
        {stage === 'winner' && (
          <>
            <div className="t-wide oscar__kicker">And the Oscar goes to</div>
            <h1 className="oscar__winner t-ticket">{winner.name}</h1>
            <p className="oscar__film">
              for <em>{film.title}</em>
            </p>
            <p className="oscar__sub">
              {cardTotal(film.score)} of {maxReelScore()} stamps
            </p>
            <button className="btn btn--big oscar__btn" onClick={() => act((g) => setPhase(g, 'ceremony'))}>
              See the scorecards
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const ordinal = (n: number) => ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'][n - 1] ?? `#${n}`;

/* ====================================================================== */
/*  Greenlight ceremony                                                    */
/* ====================================================================== */
function Ceremony({ game, act, say }: PlayProps) {
  const film = game.films[game.films.length - 1];
  const winner = studioById(game, film.studioId);
  const last = isFinalRound(game);
  return (
    <main className="page ceremony">
      <div className="t-wide">
        Reel {game.round.number} · {game.round.genre}
      </div>
      <h1 className="page-title t-ticket" style={{ textAlign: 'center' }}>
        {winner.name} gets the green light
      </h1>
      <div className="ceremony__ticket">
        <FilmTicket film={film} stamped slam />
      </div>
      <div className="ceremony__edit form-sheet no-print">
        <label className="field">
          <span>Film title</span>
          <input className="input" value={film.title} maxLength={60} onChange={(e) => act((g) => editWinningFilm(g, { title: e.target.value }), { undoable: false })} />
        </label>
        <label className="field">
          <span>Logline for the archive (optional)</span>
          <input
            className="input"
            placeholder="In a world where…"
            value={film.logline}
            maxLength={160}
            onChange={(e) => act((g) => editWinningFilm(g, { logline: e.target.value }), { undoable: false })}
          />
        </label>
      </div>
      <section className="reel-cards" aria-labelledby="reel-cards-h">
        <h2 id="reel-cards-h" className="t-ticket">
          This reel’s scorecards
        </h2>
        <div className="loyalty-grid">
          {[...game.round.pitchOrder]
            .sort((x, y) => cardTotal(game.round.scores[y]) - cardTotal(game.round.scores[x]))
            .map((id) => (
              <LoyaltyCard key={id} studio={studioById(game, id)} title={filmTitle(game, id)} rs={game.round.studios[id]} card={game.round.scores[id]} />
            ))}
        </div>
        <p className="lede" style={{ textAlign: 'center', margin: '0 auto' }}>
          {winner.name} takes the greenlight stub and now has {points(game, winner.id)} points overall.
        </p>
      </section>
      <div className="btn-row" style={{ justifyContent: 'center' }}>
        <button className="btn btn--big" onClick={() => act((g) => nextReel(g))}>
          {last ? 'Roll the final credits' : `On to reel ${game.round.number + 1}`}
        </button>
        {CAN_DOWNLOAD && (
          <button
            className="btn btn--ghost"
            onClick={() => downloadFilmTicket(film).catch(() => say({ text: 'Couldn’t save the ticket image on this device.', error: true }))}
          >
            Download the ticket
          </button>
        )}
      </div>
    </main>
  );
}

/* ====================================================================== */
/*  Final credits                                                          */
/* ====================================================================== */
function Final({ game, act, onEnd, onArchive }: PlayProps) {
  const champ = champion(game);
  const tied = leaders(game);
  const needsTieBreak = !champ && tied.length > 1;
  const judges = useMemo(() => game.studios.filter((s) => !tied.includes(s.id)), [game.studios, tied]);

  return (
    <>
    <ShopStrip />
    <main className="page centre-stack">
      <div className="t-wide">Final credits</div>
      {needsTieBreak ? (
        <>
          <h1 className="page-title t-ticket">Dead heat at the box office</h1>
          <p className="lede">
            {tied.map((id) => studioById(game, id).name).join(' and ')} are tied on {points(game, tied[0])} points and {tokens(game, tied[0])} greenlights. Settle it with one last pitch each: same cast, any genre the table shouts out.
            {judges.length > 0 ? ` ${judges.map((s) => s.name).join(', ')} decide.` : ' The whole table decides.'}
          </p>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            {tied.map((id) => (
              <button key={id} className="btn btn--go btn--big" onClick={() => act((g) => settleTie(g, id))}>
                {studioById(game, id).name} wins the tie-breaker
              </button>
            ))}
          </div>
        </>
      ) : (
        champ && (
          <>
            <p className="lede">The studio of the night is</p>
            <h1 className="champion t-ticket">{studioById(game, champ).name}</h1>
          </>
        )
      )}

      <MiniStandings game={game} title="Final standings" />

      <section style={{ width: 'min(860px, 100%)', display: 'grid', gap: 18, textAlign: 'left' }}>
        <h2 className="t-ticket" style={{ fontSize: '1.8rem' }}>
          Tonight’s pictures
        </h2>
        {game.films.map((f) => (
          <FilmTicket key={f.id} film={f} stamped compact />
        ))}
      </section>

      <div className="btn-row" style={{ justifyContent: 'center' }}>
        <button className="btn btn--big" onClick={onEnd}>
          Close the studio
        </button>
        <button className="btn btn--ghost" onClick={onArchive}>
          Open the archive
        </button>
      </div>
    </main>
    </>
  );
}
