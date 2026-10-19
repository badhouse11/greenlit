import type { Game } from '../game/types';
import { totalRounds } from '../game/engine';
import { FitText, Ticket } from '../components/Ticket';
import { ShopStrip } from '../components/ShopStrip';

export function Home({
  saved,
  onNew,
  onHost,
  onJoin,
  onWatch,
  onContinue,
  onArchive,
  onRules,
  archiveCount,
}: {
  saved: Game | null;
  onNew: () => void;
  onHost?: () => void;
  onJoin?: () => void;
  onWatch?: () => void;
  onContinue: () => void;
  onArchive: () => void;
  onRules: () => void;
  archiveCount: number;
}) {
  const unfinished = saved && saved.phase !== 'final';
  return (
    <>
    <ShopStrip />
    <main className="page home">
      <Ticket className="hero-ticket" wrapClassName="hero-wrap">
        <div className="hero-ticket__main">
          <div className="hero-ticket__kicker t-wide">A game of stars, money &amp; questionable decisions</div>
          <h1 className="wordmark">
            <FitText text="Greenlit" max={152} min={28} />
          </h1>
          <p className="hero-ticket__line">
            You’ve got $20 million. You need five stars.
            <em>You have absolutely no idea what film you’re making.</em>
          </p>
          <div className="hero-ticket__meta" aria-label="At a glance">
            <div>
              Studios<b>3–8</b>
            </div>
            <div>
              Budget<b>$20M</b>
            </div>
            <div>
              Cast<b>Five</b>
            </div>
          </div>
        </div>
        <div className="hero-ticket__stub" aria-hidden="true">
          <div className="perf-v" />
          <div style={{ display: 'flex', gap: 10 }}>
            <span className="vert vert--big">Admit one studio</span>
            <span className="vert">No refunds · No reshoots</span>
          </div>
        </div>
      </Ticket>

      {onHost && onJoin ? (
        <div className="home__actions">
          <button className="btn btn--big btn--go" onClick={onHost}>
            Start a game
          </button>
          <button className="btn btn--big" onClick={onJoin}>
            Join a game
          </button>
        </div>
      ) : null}

      <div className={`home__actions ${onHost && onJoin ? 'home__actions--quiet' : ''}`}>
        {onHost && onJoin ? (
          unfinished ? (
            <>
              <button className="link-btn" onClick={onContinue}>
                Continue your pass-the-phone game (reel {saved.round.number} of {totalRounds(saved)})
              </button>
              <button className="link-btn" onClick={onNew}>
                Start a new pass-the-phone game
              </button>
            </>
          ) : (
            <button className="link-btn" onClick={onNew}>
              Only one phone? Pass it round instead
            </button>
          )
        ) : null}
        {onHost && onJoin && onWatch ? (
          <button className="link-btn" onClick={onWatch}>
            Got a TV? Watch a game on the big screen
          </button>
        ) : unfinished ? (
          <>
            <button className="btn btn--big btn--go" onClick={onContinue}>
              Continue reel {saved.round.number} of {totalRounds(saved)}
            </button>
            <button className="btn btn--big btn--ghost" onClick={onNew}>
              Start a new game
            </button>
          </>
        ) : (
          <button className="btn btn--big" onClick={onNew}>
            Start a new game
          </button>
        )}
      </div>

      <nav className="home__foot" aria-label="More">
        <button className="link-btn" onClick={onRules}>
          How it works
        </button>
        <button className="link-btn" onClick={onArchive}>
          The archive{archiveCount ? ` (${archiveCount} ${archiveCount === 1 ? 'film' : 'films'})` : ''}
        </button>
        {saved && saved.phase === 'final' && (
          <button className="link-btn" onClick={onContinue}>
            Last game’s final credits
          </button>
        )}
      </nav>

      <p className="home__credit t-wide">A Badhouse project</p>
    </main>
    </>
  );
}
