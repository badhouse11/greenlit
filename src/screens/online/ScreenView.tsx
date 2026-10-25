import { useEffect, useState } from 'react';
import type { Game } from '../../game/types';
import type { Room } from '../../net/useRoom';
import { useTicker } from '../../net/useRoom';
import type { View } from '../../net/protocol';
import { AUCTION } from '../../net/protocol';
import { RULES, cardTotal, champion, commissioner, leaders, maxReelScore, points, standings, studioById, tokens } from '../../game/engine';
import { PREP_STEPS, prepStepLeft } from '../../net/protocol';
import { stock } from '../../lib/palette';
import { FilmTicket, Sleeve, StarTicket, StudioStub, TokenRow } from '../../components/Cards';
import { Ticket } from '../../components/Ticket';
import { ShopStrip } from '../../components/ShopStrip';
import { BidBoard } from './PhoneView';
import { OnStage, PHASE_LABEL, ReelResults, clockLeft, mmss, ordinal } from './shared';
import { usePrepClock } from './prep';

interface Props {
  room: Room;
  view: View;
}

const joinUrl = () => `${window.location.host}`;

/* ====================================================================== */
/*  The big screen                                                         */
/* ====================================================================== */
export function ScreenView({ room, view }: Props) {
  if (!view.game) return <Lobby room={room} view={view} />;
  const g = view.game;
  const showStrip = ['handover', 'final'].includes(g.phase);
  return (
    <div className="app screen-app">
      <header className="marquee no-print">
        <span className="marquee__mark">GREENLIT</span>
        <div className="marquee__reel">
          <span>
            Room {view.code} · Reel {g.round.number}/{g.order.length} · {PHASE_LABEL[g.phase]}
          </span>
          <span className="marquee__boss"> · Commissioner: {commissioner(g).name}</span>
        </div>
      </header>
      {showStrip && <ShopStrip />}
      <CrisisTalks room={room} view={view} />
      <ScreenPhase room={room} view={view} />
    </div>
  );
}

function ScreenPhase({ room, view }: Props) {
  const g = view.game!;
  switch (g.phase) {
    case 'handover':
      return <Handover room={room} view={view} />;
    case 'commission':
      return (
        <main className="page page--narrow centre-stack">
          <div className="handover-label t-wide">Genre classified</div>
          <h1 className="page-title t-ticket">{commissioner(g).name} is reading the commission</h1>
          <Sleeve genre="" showGenre={false} peeking={false} reel={g.round.number} commissionerName={commissioner(g).name} />
          <p className="lede">The Commissioner knows what you’re making. You don’t.</p>
        </main>
      );
    case 'casting':
      return <Casting room={room} view={view} />;
    case 'reveal':
      return <Reveal room={room} view={view} />;
    case 'trading':
      return <Trading view={view} room={room} />;
    case 'prep':
      return <Prep view={view} room={room} />;
    case 'pitching':
      return <Pitching room={room} view={view} />;
    case 'scoring':
      return (
        <main className="page page--narrow centre-stack">
          <div className="handover-label t-wide">Scores in private</div>
          <h1 className="page-title t-ticket">{commissioner(g).name} is deliberating</h1>
          <p className="lede">Stamps for casting, budget and plot are being punched as we speak. Look confident.</p>
        </main>
      );
    case 'oscar':
      return <Oscar room={room} view={view} />;
    case 'ceremony':
      return <Ceremony room={room} view={view} />;
    case 'final':
      return <Final room={room} view={view} />;
    default:
      return null;
  }
}

/* ---------------------------------------------------------------------- */
/*  Lobby                                                                  */
/* ---------------------------------------------------------------------- */
function Lobby({ view }: Props) {
  const n = view.lobby.length;
  const hostName = view.lobby.find((l) => l.id === view.host.studioId)?.name;
  return (
    <div className="app screen-app">
      <ShopStrip />
      <main className="page lobby">
        <section className="lobby__join">
          <Ticket className="code-ticket">
            <div className="t-wide code-ticket__kicker">Join the game at</div>
            <div className="code-ticket__url">{joinUrl()}</div>
            <div className="t-wide code-ticket__kicker">Room code</div>
            <div className="code-ticket__code t-ticket">{view.code}</div>
          </Ticket>
          <p className="lede">
            Everyone opens the site on their phone, taps <strong>Join a game</strong> and types the code. This screen just shows the game: everything is played on phones.
          </p>
        </section>
        <section className="lobby__studios">
          <h2 className="t-ticket lobby__h">
            Studios at the table <span className="muted">{n}/{RULES.maxStudios}</span>
          </h2>
          {n === 0 ? (
            <p className="lede">Waiting for the first studio to open its doors…</p>
          ) : (
            <div className="lobby-grid">
              {view.lobby.map((l) => {
                const k = stock(l.colour);
                const on = view.online.includes(l.id);
                return (
                  <Ticket key={l.id} bg={k.bg} ink={k.ink} className="lobby-stub" serrated>
                    <span className="t-ticket lobby-stub__name">{l.name}</span>
                    {!on && <span className="t-mono">offline</span>}
                  </Ticket>
                );
              })}
            </div>
          )}
          <p className="lede">
            {n < RULES.minStudios
              ? `Need ${RULES.minStudios - n} more ${RULES.minStudios - n === 1 ? 'studio' : 'studios'} to play.`
              : `${hostName ?? 'The host'} rolls camera from their phone.`}
          </p>
        </section>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Crisis talks: a phone has gone quiet                                   */
/* ---------------------------------------------------------------------- */
function CrisisTalks({ room, view }: Props) {
  const g = view.game!;
  const now = room.serverNow();
  const quiet = g.studios.filter((s) => !s.folded && !view.online.includes(s.id) && g.phase !== 'final');
  useTicker(quiet.length > 0, 1000);
  if (!quiet.length) return null;
  return (
    <div className="crisis no-print" role="status">
      {quiet.map((s) => {
        const since = view.lastSeen[s.id] ?? 0;
        const left = Math.max(0, AUCTION.graceMs - (now - since));
        return (
          <div key={s.id} className="crisis__row">
            <span>
              <strong>Crisis talks.</strong> {s.name} has gone dark.{' '}
              {left > 0 ? `Holding their seat for ${mmss(left)}.` : 'They can rejoin from any phone, or the host can act.'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Phases                                                                 */
/* ---------------------------------------------------------------------- */
function Handover({ view }: Props) {
  const g = view.game!;
  const boss = commissioner(g);
  const adjusted = Object.values(g.round.studios).filter((rs) => rs.startBudget !== RULES.startingBudget);
  return (
    <main className="page page--narrow centre-stack">
      <div className="t-wide">
        Reel {g.round.number} of {g.order.length}
      </div>
      <div className="handover-label t-wide">This reel’s Commissioner</div>
      <div className="handover-name t-ticket" style={{ color: stock(boss.colour).bg }}>
        {boss.name}
      </div>
      <p className="lede">{boss.name}, check your phone. Everyone else, you’ve got ${RULES.startingBudget}M and no idea what you’re making.</p>
      {adjusted.length > 0 && (
        <Ticket className="stub" bg="#F4E7CE" style={{ width: 'min(560px, 100%)', textAlign: 'left' }}>
          <h2 className="t-ticket" style={{ fontSize: '1.4rem' }}>
            Debts called in
          </h2>
          <ul className="settle-list">
            {adjusted.map((rs) => (
              <li key={rs.studioId}>
                <strong>{studioById(g, rs.studioId).name}</strong> starts on ${rs.startBudget}M.
              </li>
            ))}
          </ul>
        </Ticket>
      )}
      {g.roundIndex > 0 && <Standings g={g} />}
    </main>
  );
}

function Casting({ room, view }: Props) {
  const g = view.game!;
  const card = g.round.onTable;
  const a = view.auction;
  useTicker(!!a, 200);
  const studios = Object.values(g.round.studios);
  const done = studios.every((r) => r.cast.length >= RULES.castSize);
  return (
    <main className="page screen-casting">
      <section className="screen-casting__stage">
        {card ? (
          <div className={card.deck === 'legacy' ? 'vault-surprise' : 'slide-in'} key={card.id}>
            {card.deck === 'legacy' && <div className="vault-banner t-wide">From the vault</div>}
            {card.deck !== 'legacy' && card.oscar && <div className="vault-banner vault-banner--oscar t-wide">Oscar winner</div>}
            <StarTicket card={card} />
          </div>
        ) : (
          <div className="casting__empty">
            {done ? (
              <strong className="t-ticket" style={{ fontSize: '2rem' }}>
                That’s a wrap on casting
              </strong>
            ) : (
              <span>
                {view.dealer.paused ? 'The auction is paused.' : 'Next star coming up…'}{' '}
                {view.deck.legendsLeft > 0 && `${view.deck.legendsLeft} ${view.deck.legendsLeft === 1 ? 'legend is' : 'legends are'} still hidden in the deck.`}
              </span>
            )}
          </div>
        )}
      </section>
      <section className="screen-casting__board">
        {a ? (
          <BidBoard view={view} now={room.serverNow()} big />
        ) : done ? (
          <div className="centre-stack">
            <p className="lede">Every studio has five stars. {commissioner(g).name} is about to open the envelope.</p>
          </div>
        ) : (
          <div className="centre-stack">
            <p className="lede">Bid or pass from your phones. Shouting is encouraged.</p>
          </div>
        )}
      </section>
      <section className="ledger screen-ledger">
        {studios.map((rs) => (
          <StudioStub key={rs.studioId} studio={studioById(g, rs.studioId)} rs={rs} badge={a?.high?.studioId === rs.studioId ? 'Top bid' : undefined} />
        ))}
      </section>
    </main>
  );
}

function Reveal({ view }: Props) {
  const g = view.game!;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className={`reveal ${open ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label="The genre reveal">
      <div className="reveal__inner">
        <div className="reveal__kicker t-wide">Your next picture is…</div>
        <Sleeve genre={g.round.genre} showGenre={open} peeking={false} reel={g.round.number} commissionerName={commissioner(g).name} />
        <div className="reveal__after" style={{ display: 'grid', gap: 16, justifyItems: 'center' }}>
          <p style={{ opacity: 0.85 }}>You have your cast. Now make the film.</p>
        </div>
      </div>
    </div>
  );
}

function Trading({ view }: Props) {
  const g = view.game!;
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title t-ticket">The trading floor</h1>
          <p className="lede">
            The genre is <strong>{g.round.genre}</strong>. Make your one deal on your phone. {view.offers.length > 0 && `${view.offers.length} ${view.offers.length === 1 ? 'offer is' : 'offers are'} on the table.`}
          </p>
        </div>
      </div>
      {g.round.trades.length > 0 && (
        <div className="memo-list" style={{ marginBottom: 24 }}>
          {g.round.trades.map((t) => (
            <Ticket key={t.id} className="memo" serrated bg="#F4E7CE">
              <strong>{studioById(g, t.a).name}</strong> and <strong>{studioById(g, t.b).name}</strong> have done a deal.
            </Ticket>
          ))}
        </div>
      )}
      <div className="ledger">
        {Object.values(g.round.studios).map((rs) => (
          <StudioStub key={rs.studioId} studio={studioById(g, rs.studioId)} rs={rs} badge={rs.traded ? 'Dealt' : undefined} />
        ))}
      </div>
    </main>
  );
}

function Prep({ room, view }: Props) {
  const g = view.game!;
  const { left, used, running, roomStep } = usePrepClock(room, view);
  const over = left === 0;
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title t-ticket">Write your pitches</h1>
          <p className="lede">
            You’re making a <strong>{g.round.genre.toLowerCase()}</strong>. Everyone is writing on their own phone, one step at a time. Then {RULES.pitchSeconds / 60} minutes each on the clock.
          </p>
        </div>
      </div>
      <div className="prep">
        <div className="screen-prep">
          <Ticket className="clock-ticket" bg="#F4E7CE">
            <div className="clock-ticket__studio t-ticket">{over ? 'Pencils down' : running ? 'Pencils down in' : 'Clock paused'}</div>
            {!over && <div className="clock">{mmss(left)}</div>}
          </Ticket>
          <ol className="screen-prep__steps">
            {PREP_STEPS.map((step, i) => (
              <li key={step.key} className={i < roomStep ? 'is-done' : i === roomStep ? 'is-now' : ''}>
                <span className="t-ticket">{step.label}</span>
                <span className="t-mono">{i === roomStep && !over ? mmss(prepStepLeft(used, i)) : `${step.minutes} min`}</span>
              </li>
            ))}
          </ol>
        </div>
        <aside className="form-sheet prep__order">
          <h2 className="t-ticket" style={{ fontSize: '1.5rem' }}>
            Running order
          </h2>
          <ol className="order-list">
            {g.round.pitchOrder.map((id, i) => (
              <li key={id}>
                <span className="t-mono">{ordinal(i + 1)}</span>
                <span>
                  <span className="dot" style={{ background: stock(studioById(g, id).colour).bg }} />
                  {studioById(g, id).name}
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}

function Pitching({ room, view }: Props) {
  const g = view.game!;
  const id = g.round.pitchOrder[g.round.pitchCursor];
  const rs = g.round.studios[id];
  const studio = studioById(g, id);
  const k = stock(studio.colour);
  const left = clockLeft(view.clock, room.serverNow());
  const running = !!view.clock.runningSince && left > 0;
  useTicker(running, 250);
  return (
    <main className="page page--narrow centre-stack pitching">
      <div className="t-wide">
        Pitch {g.round.pitchCursor + 1} of {g.round.pitchOrder.length} · {g.round.genre}
      </div>
      <Ticket bg={k.bg} ink={k.ink} className="clock-ticket">
        <div className="clock-ticket__studio t-ticket">{studio.name}</div>
        <div className={`clock ${left <= 15000 && left > 0 ? 'is-urgent' : ''} ${left === 0 ? 'is-over' : ''}`} role="timer">
          {left === 0 ? 'Cut!' : mmss(left)}
        </div>
        <div className="clock-bar" aria-hidden="true">
          <span style={{ width: `${(left / (RULES.pitchSeconds * 1000)) * 100}%` }} />
        </div>
      </Ticket>
      <OnStage g={g} rs={rs} big />
      <p className="muted">{running ? 'The clock is running.' : left === 0 ? 'Time’s up.' : 'Start the clock from the pitching phone or the Commissioner’s.'}</p>
    </main>
  );
}

function Oscar({ view }: Props) {
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
            <p className="oscar__sub">{commissioner(g).name} is about to open it. Somebody do a drumroll.</p>
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
          </>
        )}
      </div>
    </div>
  );
}

function Ceremony({ view }: Props) {
  const g = view.game!;
  const film = g.films[g.films.length - 1];
  return (
    <main className="page ceremony">
      <div className="t-wide">
        Reel {g.round.number} · {g.round.genre}
      </div>
      <div className="ceremony__ticket">{film && <FilmTicket film={film} stamped slam />}</div>
      <ReelResults g={g} big />
    </main>
  );
}

function Final({ view }: Props) {
  const g = view.game!;
  const champ = champion(g);
  const tied = leaders(g);
  return (
    <main className="page centre-stack">
      <div className="t-wide">Final credits</div>
      {!champ && tied.length > 1 ? (
        <>
          <h1 className="page-title t-ticket">Dead heat at the box office</h1>
          <p className="lede">
            {tied.map((id) => studioById(g, id).name).join(' and ')} are level on {points(g, tied[0])} points and {tokens(g, tied[0])} greenlights. One last pitch each: same cast, any genre the table shouts out.
          </p>
          <p className="muted">The host taps in the winner from their phone.</p>
        </>
      ) : (
        champ && (
          <>
            <p className="lede">The studio of the night is</p>
            <h1 className="champion t-ticket">{studioById(g, champ).name}</h1>
          </>
        )
      )}
      <Standings g={g} title="Final standings" />
      <section style={{ width: 'min(860px, 100%)', display: 'grid', gap: 18, textAlign: 'left' }}>
        <h2 className="t-ticket" style={{ fontSize: '1.8rem' }}>
          Tonight’s pictures
        </h2>
        {g.films.map((f) => (
          <FilmTicket key={f.id} film={f} stamped compact />
        ))}
      </section>
    </main>
  );
}

function Standings({ g, title = 'The board so far' }: { g: Game; title?: string }) {
  return (
    <section style={{ width: 'min(620px, 100%)', textAlign: 'left' }}>
      <h2 className="t-ticket" style={{ fontSize: '1.6rem', marginBottom: 10 }}>
        {title}
      </h2>
      <div className="standings">
        {standings(g).map((row, i) => {
          const s = stock(row.studio.colour);
          return (
            <Ticket key={row.studio.id} bg={s.bg} ink={s.ink} className="standing" serrated>
              <span className="standing__place">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="standing__name t-ticket">
                  {row.studio.name}
                  {row.studio.folded ? ' (folded)' : ''}
                </span>
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
