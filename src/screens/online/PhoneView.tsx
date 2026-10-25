import { useEffect, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import type { Card, Game, RoundStudio, TradeSide } from '../../game/types';
import type { Room } from '../../net/useRoom';
import { useTicker } from '../../net/useRoom';
import type { Offer, View } from '../../net/protocol';
import {
  RULES,
  cardTotal,
  castingComplete,
  champion,
  commissioner,
  leaders,
  tokens,
  hasFuturePlay,
  maxBid,
  maxReelScore,
  outstandingDebt,
  points,
  reelLeaders,
  slotsLeft,
  standings,
  studioById,
  validateTrade,
} from '../../game/engine';
import { stock } from '../../lib/palette';
import { FilmTicket, LoyaltyCard, Sleeve, Stepper, TokenRow } from '../../components/Cards';
import { FitText, Ticket } from '../../components/Ticket';
import { AUCTION, PREP_STEPS } from '../../net/protocol';
import { GoogleHelp, Intro, OnStage, ReelResults, ShareInvite, auctionState, clockLeft, mmss, ordinal, useIntro } from './shared';
import { NotesSheet, PrepNotes, usePrepClock } from './prep';

interface Props {
  room: Room;
  view: View;
}

/* ====================================================================== */
/*  The phone in your hand                                                */
/* ====================================================================== */
export function PhoneView({ room, view }: Props) {
  const g = view.game!;
  const me = view.you.studioId!;
  const studio = g.studios.find((s) => s.id === me);
  if (!studio) return <main className="phone"><p className="lede">Your studio isn’t in this game.</p></main>;
  if (studio.folded) {
    return (
      <main className="phone phone--centre">
        <h1 className="t-ticket phone-title">{studio.name} has folded</h1>
        <p className="lede">Your points are frozen at {points(g, me)}. Stay for the drinks.</p>
      </main>
    );
  }
  const isComm = g.round.commissionerId === me;
  const rs = g.round.studios[me];
  return <PhoneShell room={room} view={view} isComm={isComm} rs={rs} />;
}

function PhoneShell({ room, view, isComm, rs }: Props & { isComm: boolean; rs?: RoundStudio }) {
  const [menu, setMenu] = useState(false);
  const intro = useIntro();
  const g = view.game!;
  return (
    <div className="phone-wrap">
      <PhoneBand view={view} isComm={isComm} rs={rs} onMenu={() => setMenu(true)} />
      <CrisisBanner room={room} view={view} />
      <main className="phone">{isComm ? <CommissionerPhone room={room} view={view} /> : <PlayerPhone room={room} view={view} rs={rs} />}</main>
      {g.phase === 'reveal' && <PhoneReveal room={room} view={view} isComm={isComm} />}
      {g.phase === 'oscar' && <PhoneOscar room={room} view={view} isComm={isComm} />}
      {menu && (
        <RoomMenu
          room={room}
          view={view}
          onClose={() => setMenu(false)}
          onIntro={() => {
            setMenu(false);
            intro.open();
          }}
        />
      )}
      {intro.show && g.phase !== 'reveal' && g.phase !== 'oscar' && <Intro onClose={intro.close} />}
    </div>
  );
}

function PhoneBand({ view, isComm, rs, onMenu }: { view: View; isComm: boolean; rs?: RoundStudio; onMenu: () => void }) {
  const g = view.game!;
  const s = studioById(g, view.you.studioId!);
  const k = stock(s.colour);
  return (
    <header className="phone-band" style={{ background: k.bg, color: k.ink }}>
      <div className="phone-band__top">
        <div className="phone-band__name t-ticket">{s.name}</div>
        <button className="phone-band__menu" onClick={onMenu} aria-label="Room menu">
          {view.you.isHost ? 'Host' : 'Room'} {view.code}
        </button>
      </div>
      <div className="phone-band__meta">
        {isComm ? (
          <span className="phone-band__role">Commissioner</span>
        ) : rs ? (
          <>
            <span>
              <b>${rs.budget}M</b> left
            </span>
            <span>
              <b>{rs.cast.length}</b>/{RULES.castSize} stars
            </span>
          </>
        ) : null}
        <span>
          <b>{points(g, s.id)}</b> pts
        </span>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------------- */
/*  Hold-to-peek, shared with the one-phone version                        */
/* ---------------------------------------------------------------------- */
function usePeek() {
  const [peeking, setPeeking] = useState(false);
  const [seen, setSeen] = useState(false);
  const on = () => {
    setPeeking(true);
    setSeen(true);
  };
  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      on();
    },
    onPointerUp: () => setPeeking(false),
    onPointerCancel: () => setPeeking(false),
    onPointerLeave: () => setPeeking(false),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        on();
      }
    },
    onKeyUp: () => setPeeking(false),
    onBlur: () => setPeeking(false),
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
  return { peeking, seen, handlers };
}

/* ====================================================================== */
/*  The Commissioner's phone                                              */
/* ====================================================================== */
function CommissionerPhone({ room, view }: { room: Room; view: View }) {
  const g = view.game!;
  const { act } = room;
  const peek = usePeek();
  switch (g.phase) {
    case 'handover':
      return (
        <section className="phone-stack phone--centre">
          <div className="t-wide">Reel {g.round.number}</div>
          <h1 className="t-ticket phone-title">You’re the Commissioner</h1>
          <p className="lede">Your phone shows the secret genre. Keep it to yourself, keep a straight face, and run the auction. You don’t bid this reel.</p>
          <button className="btn btn--big btn--hot" onClick={() => act({ a: 'toCommission' })}>
            Show me the commission
          </button>
          {g.roundIndex > 0 && <PhoneStandings g={g} />}
        </section>
      );
    case 'commission':
      return (
        <section className="phone-stack phone--centre">
          <p className="lede">Hold to slide the card out. Let go and it goes back in the sleeve.</p>
          <Sleeve genre={g.round.genre} showGenre={peek.peeking} peeking={peek.peeking} reel={g.round.number} commissionerName={commissioner(g).name} />
          <button className="btn btn--big btn--hot" {...peek.handlers}>
            {peek.peeking ? 'Reading…' : 'Hold to read the commission'}
          </button>
          <button className="btn btn--big" disabled={!peek.seen} onClick={() => act({ a: 'toCasting' })}>
            Seal it. Start the auction
          </button>
        </section>
      );
    case 'casting':
      return <CommissionerCasting room={room} view={view} peek={peek} />;
    case 'reveal':
      return null;
    case 'trading':
      return (
        <section className="phone-stack">
          <h1 className="t-ticket phone-title">Trading floor</h1>
          <p className="lede">Studios are dealing on their own phones. {g.round.trades.length} {g.round.trades.length === 1 ? 'deal' : 'deals'} done.</p>
          <DealsDone g={g} />
          <button className="btn btn--big btn--go" onClick={() => act({ a: 'closeTrading' })}>
            Close the trading floor
          </button>
        </section>
      );
    case 'prep':
      return <CommissionerPrep room={room} view={view} />;
    case 'pitching':
      return <PitchControls room={room} view={view} commissionerMode />;
    case 'scoring':
      return <ScoringPhone room={room} view={view} />;
    case 'oscar':
      return null;
    case 'ceremony':
      return (
        <section className="phone-stack">
          <GreenlitFilm view={view} />
          <ReelResults g={g} />
          <button className="btn btn--big" onClick={() => act({ a: 'nextReel' })}>
            {g.roundIndex === g.order.length - 1 ? 'Roll the final credits' : `On to reel ${g.round.number + 1}`}
          </button>
        </section>
      );
    case 'final':
      return <FinalPhone room={room} view={view} />;
    default:
      return null;
  }
}

function CommissionerCasting({ room, view, peek }: { room: Room; view: View; peek: ReturnType<typeof usePeek> }) {
  const g = view.game!;
  const a = view.auction;
  const card = g.round.onTable;
  const paused = view.dealer.paused;
  const done = castingComplete(g);
  useTicker(!!a || (!done && !paused), 200);
  const nextIn = view.dealer.nextAt ? Math.max(0, view.dealer.nextAt - room.serverNow()) : 0;
  return (
    <section className="phone-stack">
      <button className="btn btn--ghost btn--small" {...peek.handlers}>
        {peek.peeking ? `Genre: ${g.round.genre}` : 'Peek at the genre (hold)'}
      </button>
      {card && a ? (
        <>
          <LotCard card={card} />
          <BidBoard view={view} now={room.serverNow()} />
          <div className="btn-row btn-row--stack">
            {a.high ? (
              <button className="btn btn--big btn--go" onClick={() => room.act({ a: 'hammer' })}>
                Sell it now for ${a.high.amount}M
              </button>
            ) : (
              <button className="btn btn--ghost" onClick={() => room.act({ a: 'bin' })}>
                Skip this card
              </button>
            )}
          </div>
        </>
      ) : done ? (
        <>
          <h1 className="t-ticket phone-title">That’s a wrap on casting</h1>
          <button className="btn btn--big btn--hot" onClick={() => room.act({ a: 'openEnvelope' })}>
            Open the envelope
          </button>
        </>
      ) : (
        <>
          <p className="lede">
            {paused ? 'The auction is paused.' : nextIn > 0 ? `Next star in ${Math.ceil(nextIn / 1000)}…` : 'Next star coming up…'}{' '}
            {view.deck.legendsLeft > 0 && `${view.deck.legendsLeft} ${view.deck.legendsLeft === 1 ? 'legend is' : 'legends are'} still hiding in the deck.`}
          </p>
          <button className="btn btn--big btn--hot" onClick={() => room.act({ a: 'draw' })}>
            Next star now
          </button>
        </>
      )}
      {!done && (
        <button className="btn btn--ghost" onClick={() => room.act({ a: paused ? 'dealResume' : 'dealPause' })}>
          {paused ? 'Resume the auction' : 'Pause the auction'}
        </button>
      )}
      <p className="phone-small">Stars come up on their own. Pause it if the room needs a breather.</p>
      <MiniLedger g={g} />
    </section>
  );
}

function CommissionerPrep({ room, view }: { room: Room; view: View }) {
  const g = view.game!;
  const { left, running, roomStep } = usePrepClock(room, view);
  const over = left === 0;
  return (
    <section className="phone-stack">
      <h1 className="t-ticket phone-title">Pitch prep</h1>
      <p className="lede">Everyone is writing their pitch on their own phone, one step at a time.</p>
      <div className={`phone-clock ${over ? 'is-over' : ''}`} role="timer">
        {mmss(left)}
      </div>
      <p className="phone-small" style={{ textAlign: 'center' }}>
        {over ? 'Time’s up.' : `Now on: ${PREP_STEPS[roomStep]?.label ?? 'the last step'}.`}
      </p>
      <div className="btn-row btn-row--stack">
        {!over && (
          <button className="btn btn--ghost" onClick={() => room.act({ a: running ? 'prepPause' : 'prepResume' })}>
            {running ? 'Pause the clock' : 'Resume the clock'}
          </button>
        )}
        <button className={`btn btn--big ${over ? 'btn--hot' : ''}`} onClick={() => room.act({ a: 'firstPitch' })}>
          {over ? 'Lights. Camera. First pitch' : 'Everyone’s ready: start the pitches'}
        </button>
      </div>
      <h2 className="t-ticket phone-h2">Running order</h2>
      <RunningOrder g={g} />
    </section>
  );
}

/* ====================================================================== */
/*  A competing studio's phone                                             */
/* ====================================================================== */
function PlayerPhone({ room, view, rs }: { room: Room; view: View; rs?: RoundStudio }) {
  const g = view.game!;
  const boss = commissioner(g).name;
  if (!rs) return <p className="lede">Sit tight.</p>;
  switch (g.phase) {
    case 'handover':
    case 'commission':
      return (
        <section className="phone-stack phone--centre">
          <div className="t-wide">Reel {g.round.number}</div>
          <h1 className="t-ticket phone-title">{boss} is the Commissioner</h1>
          <p className="lede">
            {g.phase === 'handover' ? 'They’re about to read the secret genre.' : 'They’re reading the secret genre. Watch their face.'} You’ve got ${rs.budget}M for five stars.
          </p>
          {rs.startBudget !== RULES.startingBudget && (
            <p className="notice">
              Debts called in: you start this reel on ${rs.startBudget}M ({rs.startBudget > RULES.startingBudget ? 'someone paid you back' : 'you paid back an IOU'}).
            </p>
          )}
          {g.roundIndex > 0 && <PhoneStandings g={g} />}
        </section>
      );
    case 'casting':
      return <PlayerCasting room={room} view={view} rs={rs} />;
    case 'reveal':
      return null;
    case 'trading':
      return <TradingPhone room={room} view={view} rs={rs} />;
    case 'prep':
      return <PrepNotes room={room} view={view} rs={rs} />;
    case 'pitching':
      return <PitchControls room={room} view={view} />;
    case 'scoring':
      return (
        <section className="phone-stack phone--centre">
          <h1 className="t-ticket phone-title">{boss} is deliberating</h1>
          <p className="lede">Scores are being punched in private. Look confident.</p>
        </section>
      );
    case 'oscar':
      return null;
    case 'ceremony':
      return <CeremonyPhone room={room} view={view} rs={rs} />;
    case 'final':
      return <FinalPhone room={room} view={view} />;
    default:
      return null;
  }
}

function PlayerCasting({ room, view, rs }: { room: Room; view: View; rs: RoundStudio }) {
  const g = view.game!;
  const a = view.auction;
  const card = g.round.onTable;
  useTicker(!!a, 200);
  const me = view.you.studioId!;
  const full = slotsLeft(rs) === 0;
  const limit = maxBid(rs);
  if (!card || !a) {
    return (
      <section className="phone-stack">
        <p className="lede">
          {full ? 'Full house. You’ve got your five. Sit back and enjoy the bidding.' : view.dealer.paused ? 'The auction is paused.' : 'Next star coming up…'}
        </p>
        <MyCast rs={rs} />
        <MiniLedger g={g} />
      </section>
    );
  }
  const leading = a.high?.studioId === me;
  const passed = !!a.passed?.includes(me);
  const paused = a.pausedLeft != null;
  const floor = (a.high?.amount ?? 0) + 1;
  const steps = [0, 1, 4].map((extra) => floor + extra);
  return (
    <section className="phone-stack">
      <LotCard card={card} />
      <BidBoard view={view} now={room.serverNow()} />
      {full ? (
        <p className="notice">Full house. You can’t bid on this one.</p>
      ) : leading ? (
        <p className="notice notice--lead">You’re the top bid. Hold your nerve.</p>
      ) : passed ? (
        <p className="notice">You passed on this one.</p>
      ) : paused ? (
        <p className="notice">The auction is paused.</p>
      ) : (
        <>
          <div className="bid-buttons">
            {steps.map((amount, i) => (
              <button
                key={amount}
                className={`btn bid-btn ${i === 0 ? 'btn--go' : ''}`}
                disabled={amount > limit}
                onClick={() => room.act({ a: 'bid', amount })}
              >
                <small>{i === 0 ? 'Bid' : `+$${amount - (a.high?.amount ?? 0)}M`}</small>
                <b>${amount}M</b>
              </button>
            ))}
          </div>
          <button className="btn pass-btn" onClick={() => room.act({ a: 'pass' })}>
            Pass
          </button>
          <p className="phone-small">
            Your max bid is ${limit}M{limit < floor ? ', so this one is out of reach.' : ' (keeping $1M for each empty slot).'}
          </p>
        </>
      )}
      <MyCast rs={rs} />
      <MiniLedger g={g} />
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/*  Trading floor on the phone                                             */
/* ---------------------------------------------------------------------- */
const emptySide = (): TradeSide => ({ cardIds: [], cash: 0, iou: 0 });

function TradingPhone({ room, view, rs }: { room: Room; view: View; rs: RoundStudio }) {
  const g = view.game!;
  const me = view.you.studioId!;
  const [to, setTo] = useState<string | null>(null);
  const [give, setGive] = useState<TradeSide>(emptySide);
  const [get, setGet] = useState<TradeSide>(emptySide);
  const incoming = view.offers.filter((o) => o.to === me);
  const outgoing = view.offers.find((o) => o.from === me);
  const partners = Object.values(g.round.studios).filter((r) => r.studioId !== me);
  const them = to ? g.round.studios[to] : null;

  useEffect(() => {
    setGive(emptySide());
    setGet(emptySide());
  }, [to]);

  if (rs.traded) {
    return (
      <section className="phone-stack">
        <h1 className="t-ticket phone-title">Deal done</h1>
        <p className="lede">You’ve made your one deal this reel. Start thinking about the pitch.</p>
        <MyCast rs={rs} />
      </section>
    );
  }

  const terms = to ? { a: me, b: to, aGives: give, bGives: get } : null;
  const touched = give.cardIds.length + get.cardIds.length > 0;
  const problem = terms && touched ? validateTrade(g, terms) : null;
  const canIou = !!to && hasFuturePlay(g, me) && hasFuturePlay(g, to);
  const iouRoom = Math.max(0, RULES.maxIouPerStudio - outstandingDebt(g, me));
  const theirIouRoom = to ? Math.max(0, RULES.maxIouPerStudio - outstandingDebt(g, to)) : 0;

  const toggle = (side: TradeSide, set: (s: TradeSide) => void, id: string) =>
    set({ ...side, cardIds: side.cardIds.includes(id) ? side.cardIds.filter((x) => x !== id) : [...side.cardIds, id] });

  return (
    <section className="phone-stack">
      <h1 className="t-ticket phone-title">Trading floor</h1>
      <p className="lede">
        The genre is <strong>{g.round.genre}</strong>. One deal each. Swap the same number of stars each way.
      </p>

      {incoming.map((o) => (
        <OfferCard key={o.id} g={g} o={o} me={me}>
          <div className="btn-row">
            <button className="btn btn--go" onClick={() => room.act({ a: 'acceptOffer', id: o.id })}>
              Shake on it
            </button>
            <button className="btn btn--ghost" onClick={() => room.act({ a: 'declineOffer', id: o.id })}>
              Turn it down
            </button>
          </div>
        </OfferCard>
      ))}

      {outgoing ? (
        <OfferCard g={g} o={outgoing} me={me}>
          <p className="phone-small">Waiting for {studioById(g, outgoing.to).name} to answer.</p>
          <button className="btn btn--ghost btn--small" onClick={() => room.act({ a: 'cancelOffer' })}>
            Withdraw the offer
          </button>
        </OfferCard>
      ) : (
        <div className="form-sheet deal-builder">
          <div className="field">
            <span>Deal with</span>
            <div className="picker">
              {partners.map((p) => (
                <button
                  key={p.studioId}
                  className="chip"
                  aria-pressed={to === p.studioId}
                  disabled={p.traded}
                  onClick={() => setTo(to === p.studioId ? null : p.studioId)}
                >
                  {studioById(g, p.studioId).name}
                </button>
              ))}
            </div>
          </div>
          {them && (
            <>
              <CastPicker title="You give" cast={rs.cast} picked={give.cardIds} onToggle={(id) => toggle(give, setGive, id)} />
              <CastPicker title="You get" cast={them.cast} picked={get.cardIds} onToggle={(id) => toggle(get, setGet, id)} />
              <div className="money-row">
                <div className="field">
                  <span>You add cash</span>
                  <Stepper small value={give.cash} min={0} max={rs.budget} onChange={(n) => setGive({ ...give, cash: n })} label="cash you add" />
                </div>
                <div className="field">
                  <span>They add cash</span>
                  <Stepper small value={get.cash} min={0} max={them.budget} onChange={(n) => setGet({ ...get, cash: n })} label="cash they add" />
                </div>
                <div className="field">
                  <span>You owe (IOU)</span>
                  <Stepper small value={give.iou} min={0} max={canIou ? iouRoom : 0} disabled={!canIou} onChange={(n) => setGive({ ...give, iou: n })} label="IOU you give" />
                </div>
                <div className="field">
                  <span>They owe (IOU)</span>
                  <Stepper small value={get.iou} min={0} max={canIou ? theirIouRoom : 0} disabled={!canIou} onChange={(n) => setGet({ ...get, iou: n })} label="IOU they give" />
                </div>
              </div>
              {!canIou && <p className="phone-small">IOUs need a next picture for both studios.</p>}
              {problem && (
                <div className="notice notice--error" role="alert">
                  {problem}
                </div>
              )}
              <button
                className="btn btn--big btn--go"
                disabled={!touched || !!problem}
                onClick={() => room.act({ a: 'offer', to: to!, fromGives: give, toGives: get })}
              >
                Send the offer
              </button>
            </>
          )}
        </div>
      )}
      <MyCast rs={rs} />
    </section>
  );
}

function CastPicker({ title, cast, picked, onToggle }: { title: string; cast: RoundStudio['cast']; picked: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="field">
      <span>{title}</span>
      <ul className="give-list">
        {cast.map((c) => (
          <li key={c.id}>
            <label>
              <input type="checkbox" checked={picked.includes(c.id)} onChange={() => onToggle(c.id)} />
              <span>
                {c.name}
                {c.deck === 'legacy' ? ' ★' : ''}
              </span>
              <span className="muted">${c.price}M</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function describeSide(g: Game, owner: string, s: TradeSide) {
  const cast = g.round.studios[owner]?.cast ?? [];
  const parts = s.cardIds.map((id) => cast.find((c) => c.id === id)?.name ?? '?');
  if (s.cash) parts.push(`$${s.cash}M cash`);
  if (s.iou) parts.push(`a $${s.iou}M IOU`);
  return parts.length ? parts.join(' + ') : 'nothing';
}

function OfferCard({ g, o, me, children }: { g: Game; o: Offer; me: string; children: ReactNode }) {
  const incoming = o.to === me;
  const other = incoming ? o.from : o.to;
  return (
    <Ticket className="memo offer-card" serrated bg="#F4E7CE">
      <strong>{incoming ? `Offer from ${studioById(g, other).name}` : `Your offer to ${studioById(g, other).name}`}</strong>
      <p>
        {incoming ? 'They give' : 'You give'}: {describeSide(g, o.from, o.fromGives)}
        <br />
        {incoming ? 'You give' : 'They give'}: {describeSide(g, o.to, o.toGives)}
      </p>
      {children}
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/*  Pitches                                                                */
/* ---------------------------------------------------------------------- */
function TitleField({ room, rs }: { room: Room; rs: RoundStudio }) {
  const [draft, setDraft] = useState(rs.title);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (draft !== rs.title) room.act({ a: 'title', title: draft });
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  return (
    <label className="field">
      <span>Your film’s title</span>
      <input id="film-title" className="input" placeholder="Working title" value={draft} maxLength={60} onChange={(e) => setDraft(e.target.value)} />
    </label>
  );
}

function PitchControls({ room, view, commissionerMode = false }: { room: Room; view: View; commissionerMode?: boolean }) {
  const g = view.game!;
  const me = view.you.studioId!;
  const onId = g.round.pitchOrder[g.round.pitchCursor];
  const onStage = onId === me;
  const rs = g.round.studios[me];
  const left = clockLeft(view.clock, room.serverNow());
  const running = !!view.clock.runningSince && left > 0;
  useTicker(running, 250);
  const last = g.round.pitchCursor === g.round.pitchOrder.length - 1;
  const fresh = left === RULES.pitchSeconds * 1000;
  const controls = onStage || commissionerMode;
  return (
    <section className="phone-stack phone--centre">
      <div className="t-wide">
        Pitch {g.round.pitchCursor + 1} of {g.round.pitchOrder.length}
      </div>
      <h1 className="t-ticket phone-title">{onStage ? 'You’re on' : `${studioById(g, onId).name} is pitching`}</h1>
      <div className={`phone-clock ${left <= 15000 && left > 0 ? 'is-urgent' : ''} ${left === 0 ? 'is-over' : ''}`} role="timer">
        {left === 0 ? 'Cut!' : mmss(left)}
      </div>
      {controls && (
        <div className="btn-row btn-row--stack">
          {left > 0 &&
            (running ? (
              <button className="btn btn--big btn--ghost" onClick={() => room.act({ a: 'clockPause' })}>
                Pause the clock
              </button>
            ) : (
              <button className="btn btn--big btn--hot" onClick={() => room.act({ a: 'clockStart' })}>
                {fresh ? 'Start the clock' : 'Resume'}
              </button>
            ))}
          <button className={`btn btn--big ${left === 0 ? 'btn--go' : 'btn--ghost'}`} onClick={() => room.act({ a: 'nextPitch' })}>
            {onStage ? 'That’s my pitch' : last ? 'That’s all the pitches' : 'Next studio'}
          </button>
        </div>
      )}
      {onStage && rs ? (
        <NotesSheet notes={view.notes} rs={rs} title={rs.title.trim() || `Untitled ${g.round.genre} Project`} />
      ) : (
        <OnStage g={g} rs={g.round.studios[onId]} />
      )}
      {onStage && rs && (
        <details className="example">
          <summary>Change your title</summary>
          <TitleField room={room} rs={rs} />
        </details>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/*  Scoring and after                                                      */
/* ---------------------------------------------------------------------- */
function ScoringPhone({ room, view }: { room: Room; view: View }) {
  const g = view.game!;
  const [vote, setVote] = useState<string | null>(null);
  const top = reelLeaders(g);
  const anyScored = Object.values(g.round.scores).some((c) => cardTotal(c) > 0);
  const tie = anyScored && top.length > 1;
  return (
    <section className="phone-stack">
      <h1 className="t-ticket phone-title">Punch the cards</h1>
      <p className="lede">Up to {RULES.stampsPerCategory} stamps each for casting, budget and plot. Nobody sees these until the envelope.</p>
      <div className="loyalty-grid">
        {g.round.pitchOrder.map((id) => (
          <LoyaltyCard
            key={id}
            studio={studioById(g, id)}
            title={g.round.studios[id].title.trim() || `Untitled ${g.round.genre} Project`}
            rs={g.round.studios[id]}
            card={g.round.scores[id]}
            onPunch={(cat, value) => room.act({ a: 'score', studioId: id, cat, value })}
          />
        ))}
      </div>
      <div className="form-sheet lock-panel">
        {tie ? (
          <>
            <p>
              <strong>Dead heat.</strong> Give your casting vote. Everyone still keeps their points.
            </p>
            <div className="picker">
              {top.map((id) => (
                <button key={id} className="chip" aria-pressed={vote === id} onClick={() => setVote(id)}>
                  {studioById(g, id).name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">{anyScored ? 'Happy with your stamps? Seal the envelope.' : 'Punch at least one stamp first.'}</p>
        )}
        <button className="btn btn--big btn--go" disabled={!anyScored || (tie && !vote)} onClick={() => room.act({ a: 'seal', vote: tie ? vote ?? undefined : undefined })}>
          Seal the envelope
        </button>
      </div>
    </section>
  );
}

function CeremonyPhone({ room, view, rs }: { room: Room; view: View; rs: RoundStudio }) {
  const g = view.game!;
  const me = view.you.studioId!;
  const won = g.round.winnerId === me;
  const film = g.films[g.films.length - 1];
  const [logline, setLogline] = useState(film?.logline ?? '');
  useEffect(() => {
    if (!won) return;
    const t = window.setTimeout(() => {
      if (logline !== (film?.logline ?? '')) room.act({ a: 'logline', text: logline });
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logline]);
  return (
    <section className="phone-stack">
      <GreenlitFilm view={view} />
      {won && (
        <label className="field">
          <span>Logline for the archive</span>
          <input id="logline" className="input" placeholder="In a world where…" value={logline} maxLength={160} onChange={(e) => setLogline(e.target.value)} />
        </label>
      )}
      <ReelResults g={g} me={me} />
      {rs && (
        <p className="phone-small">
          You scored {cardTotal(g.round.scores[me])} of {maxReelScore()} this reel. {points(g, me)} points overall.
        </p>
      )}
    </section>
  );
}

function FinalPhone({ room, view }: Props) {
  const g = view.game!;
  const champ = champion(g);
  const tied = leaders(g);
  const me = view.you.studioId!;
  const place = standings(g).findIndex((r) => r.studio.id === me) + 1;
  return (
    <section className="phone-stack">
      <div className="phone--centre phone-stack">
        <div className="t-wide">Final credits</div>
        {!champ && tied.length > 1 ? (
          <>
            <h1 className="t-ticket phone-title">Dead heat at the box office</h1>
            <p className="lede">
              {tied.map((id) => studioById(g, id).name).join(' and ')} are level. One last pitch each: same cast, any genre the table shouts out. The rest of you decide.
            </p>
            {view.you.isHost &&
              tied.map((id) => (
                <button key={id} className="btn btn--go" onClick={() => room.act({ a: 'tieBreak', studioId: id })}>
                  {studioById(g, id).name} wins the tie-breaker
                </button>
              ))}
            {!view.you.isHost && <p className="phone-small">The host taps in the winner.</p>}
          </>
        ) : (
          champ && (
            <>
              <p className="lede">The studio of the night is</p>
              <h1 className="champion t-ticket">{studioById(g, champ).name}</h1>
              {champ !== me && <p className="phone-small">You finished {ordinal(place).toLowerCase()}.</p>}
            </>
          )
        )}
      </div>
      <PhoneStandings g={g} title="Final standings" />
      <h2 className="t-ticket phone-h2">Tonight’s pictures</h2>
      {g.films.map((f) => (
        <FilmTicket key={f.id} film={f} stamped compact />
      ))}
      {view.you.isHost ? (
        <button className="btn btn--big" onClick={() => room.act({ a: 'backToLobby' })}>
          Run it back: new game, same studios
        </button>
      ) : (
        <p className="phone-small">The host can start another game with the same studios.</p>
      )}
    </section>
  );
}

function GreenlitFilm({ view }: { view: View }) {
  const g = view.game!;
  const film = g.films[g.films.length - 1];
  if (!film) return null;
  return (
    <div className="phone-film">
      <div className="t-wide">
        Reel {g.round.number} · {g.round.genre}
      </div>
      <FilmTicket film={film} stamped slam compact />
    </div>
  );
}

function PhoneStandings({ g, title = 'The board so far' }: { g: Game; title?: string }) {
  return (
    <section className="phone-standings">
      <h2 className="t-ticket phone-h2">{title}</h2>
      <ol className="phone-standings__list">
        {standings(g).map((row, i) => (
          <li key={row.studio.id}>
            <span className="t-mono">{String(i + 1).padStart(2, '0')}</span>
            <span>
              <span className="dot" style={{ background: stock(row.studio.colour).bg }} />
              {row.studio.name}
              {row.studio.folded ? ' (folded)' : ''}
              <TokenRow count={tokens(g, row.studio.id)} />
            </span>
            <b>{row.points}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/*  The big moments, on every phone at once                                */
/* ---------------------------------------------------------------------- */
function PhoneReveal({ room, view, isComm }: Props & { isComm: boolean }) {
  const g = view.game!;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className={`reveal reveal--phone ${open ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label="The genre reveal">
      <div className="reveal__inner">
        <div className="reveal__kicker t-wide">Your next picture is…</div>
        <Sleeve genre={g.round.genre} showGenre={open} peeking={false} reel={g.round.number} commissionerName={commissioner(g).name} />
        <div className="reveal__after" style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
          <p style={{ opacity: 0.85 }}>You have your cast. Now make the film.</p>
          {isComm ? (
            <button className="btn btn--big" style={{ ['--b-bg' as string]: '#F4E7CE', ['--b-ink' as string]: '#1D1814' }} onClick={() => room.act({ a: 'toTrading' })}>
              Open the trading floor
            </button>
          ) : (
            <p className="phone-small" style={{ color: 'inherit', opacity: 0.7 }}>
              {commissioner(g).name} opens the trading floor next.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PhoneOscar({ room, view, isComm }: Props & { isComm: boolean }) {
  const g = view.game!;
  const stage = view.oscar.stage;
  const film = g.films[g.films.length - 1];
  const winner = stage === 'winner' && g.round.winnerId ? studioById(g, g.round.winnerId) : null;
  return (
    <div className={`oscar oscar--${stage}`} role="dialog" aria-modal="true" aria-label="The Oscar">
      <div className="oscar__inner">
        {stage === 'table' && (
          <>
            <div className="t-wide oscar__kicker">
              Reel {g.round.number} · {g.round.genre}
            </div>
            <p className="oscar__line t-ticket">The envelope, please.</p>
            {isComm ? (
              <>
                <p className="oscar__sub">Put your phone in the middle of the table. Somebody do a drumroll.</p>
                <button className="btn btn--big oscar__btn" onClick={() => room.act({ a: 'oscarOpen' })}>
                  Open the envelope
                </button>
              </>
            ) : (
              <p className="oscar__sub">{commissioner(g).name} is about to open it. Somebody do a drumroll.</p>
            )}
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
        {winner && film && (
          <>
            <div className="t-wide oscar__kicker">And the Oscar goes to</div>
            <h1 className="oscar__winner t-ticket">{winner.name}</h1>
            <p className="oscar__film">
              for <em>{film.title}</em>
            </p>
            <p className="oscar__sub">
              {cardTotal(film.score)} of {maxReelScore()} stamps
            </p>
            {isComm ? (
              <button className="btn btn--big oscar__btn" onClick={() => room.act({ a: 'toCeremony' })}>
                See the scorecards
              </button>
            ) : (
              <p className="oscar__sub">Scorecards next.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Crisis talks and the room menu                                         */
/* ---------------------------------------------------------------------- */
function CrisisBanner({ room, view }: Props) {
  const g = view.game!;
  const now = room.serverNow();
  const quiet = g.studios.filter((s) => !s.folded && s.id !== view.you.studioId && !view.online.includes(s.id) && g.phase !== 'final');
  useTicker(quiet.length > 0, 1000);
  if (!quiet.length) return null;
  const canAct = view.you.isHost || view.host.away;
  return (
    <div className="crisis crisis--phone" role="status">
      {quiet.map((s) => {
        const left = Math.max(0, AUCTION.graceMs - (now - (view.lastSeen[s.id] ?? 0)));
        const isComm = s.id === g.round.commissionerId;
        return (
          <div key={s.id} className="crisis__row">
            <span>
              <strong>Crisis talks.</strong> {s.name} has gone dark. {left > 0 ? `Holding their seat for ${mmss(left)}.` : 'They can rejoin from any phone with the room code.'}
            </span>
            {left === 0 &&
              canAct &&
              (isComm ? (
                <button className="btn btn--small btn--hot" onClick={() => room.act({ a: 'fireCommissioner' })}>
                  Fire the Commissioner
                </button>
              ) : (
                <button className="btn btn--small btn--hot" onClick={() => room.act({ a: 'fold', studioId: s.id })}>
                  Fold {s.name}
                </button>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function RoomMenu({ room, view, onClose, onIntro }: Props & { onClose: () => void; onIntro: () => void }) {
  const g = view.game!;
  const hostName = view.host.studioId ? g.studios.find((s) => s.id === view.host.studioId)?.name : null;
  const canHost = view.you.isHost || view.host.away;
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="room-menu-h" onClick={onClose}>
      <div className="form-sheet dialog room-menu" onClick={(e) => e.stopPropagation()}>
        <div className="room-menu__code">
          <span className="t-wide">Room code</span>
          <b className="t-ticket" id="room-menu-h">
            {view.code}
          </b>
          <ShareInvite code={view.code} />
        </div>
        <p className="phone-small">
          A phone died? The new phone joins with this code and takes over the studio. Got a TV? Open {window.location.host} on it, tap <strong>Watch on a big screen</strong>, and type the code.
        </p>
        <hr className="form-sheet__rule" />
        {view.you.isHost ? (
          <p>
            <strong>You’re the host.</strong> You look after the housekeeping.
          </p>
        ) : view.host.away ? (
          <p>
            <strong>{hostName ?? 'The host'} has gone quiet.</strong> Anyone can step in: use a control below and you become the host.
          </p>
        ) : (
          <p>
            Hosted by <strong>{hostName ?? 'the host'}</strong>.
          </p>
        )}
        {canHost && (
          <div className="btn-row btn-row--stack">
            <button
              className="btn btn--ghost"
              disabled={!view.canUndo}
              onClick={() => {
                room.act({ a: 'undo' });
                onClose();
              }}
            >
              Undo the last move
            </button>
          </div>
        )}
        <button className="btn btn--ghost" onClick={onIntro}>
          How to play
        </button>
        <button className="btn" onClick={onClose}>
          Back to the game
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Small pieces                                                           */
/* ---------------------------------------------------------------------- */
export function LotCard({ card }: { card: Card }) {
  const legacy = card.deck === 'legacy';
  const kicker = legacy ? (card.oscar ? 'Vault · Oscar winner' : 'From the vault') : card.oscar ? 'Oscar winner' : 'Now casting';
  return (
    <div className="lot-wrap" key={card.id}>
      <Ticket
        serrated
        frame={false}
        className={`lot ${legacy ? 'lot--legacy' : ''} ${card.oscar ? 'lot--oscar' : ''}`}
        wrapClassName={legacy ? 'vault-surprise' : 'slide-in'}
      >
        <div className="lot__kicker t-wide">{kicker}</div>
        <div className="lot__name t-ticket">
          <FitText text={card.name} max={44} min={16} />
        </div>
      </Ticket>
      <GoogleHelp name={card.name} />
    </div>
  );
}

export function BidBoard({ view, now, big = false }: { view: View; now: number; big?: boolean }) {
  const a = view.auction;
  if (!a) return null;
  const s = auctionState(a, now);
  const leader = a.high ? studioById(view.game!, a.high.studioId) : null;
  return (
    <div className={`bid-board ${big ? 'bid-board--big' : ''}`} aria-live="polite">
      <div className="bid-board__call t-wide">{s.call}</div>
      <div className="bid-board__price t-ticket">{a.high ? `$${a.high.amount}M` : 'No bids'}</div>
      <div className="bid-board__leader">
        {leader ? (
          <span className="chip chip--studio" style={{ ['--chip-bg' as string]: stock(leader.colour).bg, ['--chip-ink' as string]: stock(leader.colour).ink }}>
            {leader.name}
          </span>
        ) : (
          <span className="muted">Opening bid $1M</span>
        )}
      </div>
      <div className="bid-board__bar" aria-hidden="true">
        <span style={{ width: `${s.fraction * 100}%` }} />
      </div>
      {!!a.passed?.length && <div className="bid-board__passed">Passed: {a.passed.map((id) => studioById(view.game!, id).name).join(', ')}</div>}
    </div>
  );
}

function MyCast({ rs }: { rs: RoundStudio }) {
  return (
    <ol className="slots phone-slots">
      {Array.from({ length: RULES.castSize }, (_, i) => {
        const c = rs.cast[i];
        return (
          <li key={i} className={c ? '' : 'empty'}>
            <span>{i + 1}</span>
            <span>
              {c ? c.name : 'Open slot'}
              {c?.oscar && <span className="oscar-mark">Oscar</span>}
              {c?.deck === 'legacy' && <span className="legacy-mark">Vault</span>}
            </span>
            <span>{c ? `$${c.price}M` : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

function MiniLedger({ g }: { g: Game }) {
  return (
    <ul className="mini-ledger">
      {Object.values(g.round.studios).map((r) => {
        const s = studioById(g, r.studioId);
        return (
          <li key={r.studioId}>
            <span>
              <span className="dot" style={{ background: stock(s.colour).bg }} />
              {s.name}
            </span>
            <span>
              {r.cast.length}/{RULES.castSize} · ${r.budget}M · max ${maxBid(r)}M
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RunningOrder({ g }: { g: Game }) {
  return (
    <ol className="order-list">
      {g.round.pitchOrder.map((id, i) => (
        <li key={id}>
          <span className="t-mono">{ordinal(i + 1)}</span>
          <span>{studioById(g, id).name}</span>
        </li>
      ))}
    </ol>
  );
}

function DealsDone({ g }: { g: Game }) {
  if (!g.round.trades.length) return null;
  return (
    <ul className="mini-ledger">
      {g.round.trades.map((t) => (
        <li key={t.id}>
          {studioById(g, t.a).name} ⇄ {studioById(g, t.b).name}
        </li>
      ))}
    </ul>
  );
}
