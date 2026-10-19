import { useCallback, useEffect, useRef, useState } from 'react';
import type { Game, GreenlitFilm } from './game/types';
import { RuleError, commissioner, totalRounds } from './game/engine';
import { loadArchive, loadGame, mergeIntoArchive, saveArchive, saveGame } from './lib/storage';
import { Home } from './screens/Home';
import { Setup } from './screens/Setup';
import { Play } from './screens/Play';
import { Archive } from './screens/Archive';
import { Rules } from './screens/Rules';
import { PrintShop } from './screens/PrintShop';
import { JoinRoom, StartRoom } from './screens/online/OnlineRoom';
import { MULTIPLAYER_READY } from './net/useRoom';

/** A link like greenlit.app/?room=ABCD drops a phone straight into that room. */
const linkedRoom = (() => {
  try {
    return new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? null;
  } catch {
    return null;
  }
})();

export type View = 'home' | 'setup' | 'game' | 'archive' | 'rules' | 'print' | 'start' | 'join' | 'watch';

export interface Toast {
  text: string;
  error?: boolean;
}

/** Every game action is a pure function from one Game to the next. */
export type Act = (fn: (g: Game) => Game, opts?: { undoable?: boolean; note?: string }) => boolean;

const PHASE_LABEL: Record<Game['phase'], string> = {
  handover: 'Handover',
  commission: 'The commission',
  casting: 'Casting auction',
  reveal: 'The reveal',
  trading: 'Trading floor',
  prep: 'Pitch prep',
  pitching: 'The pitches',
  scoring: 'Scoring',
  oscar: 'The envelope',
  ceremony: 'Greenlight ceremony',
  final: 'Final credits',
};

export default function App() {
  const [game, setGame] = useState<Game | null>(() => loadGame());
  const [past, setPast] = useState<Game[]>([]);
  const [view, setView] = useState<View>(() => (linkedRoom ? 'join' : 'home'));
  const [returnTo, setReturnTo] = useState<View>('home');
  const [archive, setArchive] = useState<GreenlitFilm[]>(() => loadArchive());
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const say = useCallback((t: Toast) => {
    window.clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = window.setTimeout(() => setToast(null), t.error ? 5200 : 3200);
  }, []);

  useEffect(() => saveGame(game), [game]);

  useEffect(() => {
    if (!game) return;
    setArchive((a) => {
      const next = mergeIntoArchive(a, game.id, game.films);
      if (next !== a) saveArchive(next);
      return next;
    });
  }, [game]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, game?.phase, game?.roundIndex]);

  const act: Act = useCallback(
    (fn, opts = {}) => {
      if (!game) return false;
      try {
        const next = fn(game);
        if (opts.undoable !== false) setPast((p) => [...p.slice(-59), game]);
        setGame(next);
        if (opts.note) say({ text: opts.note });
        return true;
      } catch (e) {
        if (e instanceof RuleError) {
          say({ text: e.message, error: true });
          return false;
        }
        throw e;
      }
    },
    [game, say],
  );

  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    setGame(prev);
    say({ text: 'Undone. The studio lawyers have shredded the evidence.' });
  };

  const startGame = (g: Game) => {
    setGame(g);
    setPast([]);
    setView('game');
  };

  const endGame = () => {
    setGame(null);
    setPast([]);
    setView('home');
  };

  const openAside = (v: View) => {
    setReturnTo(view);
    setView(v);
  };

  const removeFilm = (id: string) => {
    setArchive((a) => {
      const next = a.filter((f) => f.id !== id);
      saveArchive(next);
      return next;
    });
  };

  const clearArchive = () => {
    setArchive([]);
    saveArchive([]);
  };

  const inGame = view === 'game' && game;

  return (
    <div className="app">
      {inGame && (
        <header className="marquee no-print">
          <button className="marquee__mark" onClick={() => setView('home')} aria-label="GREENLIT home">
            GREENLIT
          </button>
          <div className="marquee__reel">
            <span>
              Reel {game.round.number}/{totalRounds(game)} · {PHASE_LABEL[game.phase]}
            </span>
            <span className="marquee__boss"> · Commissioner: {commissioner(game).name}</span>
          </div>
          <div className="marquee__tools">
            <button className="tool" onClick={undo} disabled={past.length === 0}>
              Undo
            </button>
            <button className="tool" onClick={() => openAside('rules')}>
              Rules
            </button>
          </div>
        </header>
      )}

      {view === 'home' && (
        <Home
          saved={game}
          onNew={() => setView('setup')}
          onHost={MULTIPLAYER_READY ? () => setView('start') : undefined}
          onJoin={MULTIPLAYER_READY ? () => setView('join') : undefined}
          onWatch={MULTIPLAYER_READY ? () => setView('watch') : undefined}
          onContinue={() => setView('game')}
          onArchive={() => openAside('archive')}
          onRules={() => openAside('rules')}
          archiveCount={archive.length}
        />
      )}
      {view === 'setup' && <Setup onCancel={() => setView('home')} onStart={startGame} hasSaved={!!game} />}
      {inGame && <Play game={game} act={act} say={say} onEnd={endGame} onArchive={() => openAside('archive')} />}
      {view === 'archive' && (
        <Archive films={archive} onBack={() => setView(returnTo)} onRemove={removeFilm} onClear={clearArchive} />
      )}
      {view === 'rules' && <Rules onBack={() => setView(returnTo)} />}
      {view === 'start' && <StartRoom onExit={() => setView('home')} />}
      {view === 'watch' && <JoinRoom watch onExit={() => setView('home')} />}
      {view === 'join' && (
        <JoinRoom
          initialCode={linkedRoom ?? undefined}
          onExit={() => {
            if (linkedRoom) window.history.replaceState(null, '', window.location.pathname);
            setView('home');
          }}
        />
      )}
      {view === 'print' && <PrintShop onBack={() => setView(returnTo)} />}

      {toast && (
        <div className={`toast no-print ${toast.error ? 'toast--error' : ''}`} role={toast.error ? 'alert' : 'status'}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
