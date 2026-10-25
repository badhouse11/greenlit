import { useEffect, useRef, useState } from 'react';
import type { Game, RoundStudio } from '../../game/types';
import type { Auction, Clock, RoomEvent, View } from '../../net/protocol';
import { AUCTION } from '../../net/protocol';
import { CATEGORIES, RULES, cardTotal, points, studioById } from '../../game/engine';
import { stock } from '../../lib/palette';

export const PHASE_LABEL: Record<Game['phase'], string> = {
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

/** A plain web search for a name. We don't store or show any pictures ourselves. */
export const googleLink = (name: string) => `https://www.google.com/search?q=${encodeURIComponent(name)}`;

export function GoogleHelp({ name }: { name: string }) {
  return (
    <a className="who-btn" href={googleLink(name)} target="_blank" rel="noopener noreferrer">
      Google, help me!
    </a>
  );
}

export const ordinal = (n: number) => ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'][n - 1] ?? `#${n}`;

/** Live auction numbers, from the server's clock. */
export function auctionState(a: Auction, now: number) {
  if (a.pausedLeft != null) {
    const total = a.high ? AUCTION.bidMs : AUCTION.openMs;
    return { left: a.pausedLeft, fraction: Math.min(1, a.pausedLeft / total), call: 'Paused' };
  }
  const left = Math.max(0, a.endsAt - now);
  const total = a.high ? AUCTION.bidMs : AUCTION.openMs;
  const call = !a.high ? 'Opening bids' : left <= 2000 ? 'Going twice…' : left <= 4500 ? 'Going once…' : 'Bidding';
  return { left, fraction: Math.min(1, left / total), call };
}

export const clockLeft = (c: Clock, now: number) => Math.max(0, c.remainingMs - (c.runningSince ? now - c.runningSince : 0));

export const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Shows each new room event once, as a toast. */
export function useEventToast(event: RoomEvent | null) {
  const [shown, setShown] = useState<RoomEvent | null>(null);
  const last = useRef<number | null>(null);
  // A new event id shows a toast; repeats of the same event (every state update carries it) do nothing.
  // Whatever happened before this device connected is old news.
  useEffect(() => {
    if (!event) return;
    if (last.current === null) {
      last.current = event.id;
      return;
    }
    if (event.id === last.current) return;
    last.current = event.id;
    setShown(event);
  }, [event]);
  // The timer belongs to the toast being shown, so later updates can't cancel it.
  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => setShown(null), 3600);
    return () => window.clearTimeout(t);
  }, [shown]);
  return shown;
}

export function EventToast({ event }: { event: RoomEvent | null }) {
  const shown = useEventToast(event);
  if (!shown) return null;
  return (
    <div className={`toast no-print toast--${shown.tone ?? 'plain'}`} role="status">
      {shown.text}
    </div>
  );
}

export function ErrorToast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDone, 4200);
    return () => window.clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="toast toast--error no-print" role="alert">
      {message}
    </div>
  );
}

export function ConnectionBadge({ status }: { status: string }) {
  if (status === 'open') return null;
  return <div className="conn-badge">{status === 'gone' ? 'Disconnected' : 'Reconnecting…'}</div>;
}

export function StudioDot({ colour }: { colour: string }) {
  return <span className="dot" style={{ background: stock(colour).bg }} />;
}

export const nameOf = (v: View, id: string | null | undefined) => (id && v.game ? studioById(v.game, id).name : '');

/* ---------------------------------------------------------------------- */
/*  Inviting people in                                                     */
/* ---------------------------------------------------------------------- */
export const inviteLink = (code: string) => `${window.location.origin}/?room=${code}`;

export function ShareInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = inviteLink(code);
  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'GREENLIT', text: `Join my GREENLIT game. Room code ${code}.`, url: link });
        return;
      } catch {
        /* cancelled: fall through to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt?.('Copy this invite link', link);
    }
  };
  return (
    <button className="btn btn--small share-btn" onClick={share}>
      {copied ? 'Link copied' : 'Share invite link'}
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/*  Who's on stage: the film everyone is listening to                      */
/* ---------------------------------------------------------------------- */
export function OnStage({ g, rs, big = false }: { g: Game; rs: RoundStudio; big?: boolean }) {
  const studio = studioById(g, rs.studioId);
  const spent = rs.startBudget - rs.budget;
  return (
    <div className={`on-stage ${big ? 'on-stage--big' : ''}`}>
      <div className="on-stage__title t-ticket">{rs.title.trim() || `Untitled ${g.round.genre} Project`}</div>
      <div className="on-stage__studio t-wide">{studio.name} presents</div>
      <ol className="on-stage__cast">
        {rs.cast.map((c) => (
          <li key={c.id} className={c.oscar ? 'is-oscar' : ''}>
            <span>
              {c.name}
              {c.oscar && <span className="oscar-mark">Oscar</span>}
              {c.deck === 'legacy' && <span className="legacy-mark">Vault</span>}
            </span>
            <span className="t-mono">${c.price}M</span>
          </li>
        ))}
      </ol>
      <div className="on-stage__spend">
        Spent <b>${spent}M</b> of ${rs.startBudget}M{rs.budget > 0 ? ` · $${rs.budget}M unspent` : ' · every penny'}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  After the Oscar: how every film scored, with the running points        */
/* ---------------------------------------------------------------------- */
function Pips({ n }: { n: number }) {
  return (
    <span className="pips" aria-label={`${n} of ${RULES.stampsPerCategory}`}>
      {Array.from({ length: RULES.stampsPerCategory }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''} />
      ))}
    </span>
  );
}

export function ReelResults({ g, me, big = false }: { g: Game; me?: string | null; big?: boolean }) {
  const ids = [...g.round.pitchOrder].sort((x, y) => cardTotal(g.round.scores[y]) - cardTotal(g.round.scores[x]));
  return (
    <section className={`results ${big ? 'results--big' : ''}`} aria-labelledby="results-h">
      <h2 id="results-h" className="t-ticket results__h">
        How the reel scored
      </h2>
      <ol className="results__list">
        {ids.map((id, i) => {
          const s = studioById(g, id);
          const card = g.round.scores[id];
          const rs = g.round.studios[id];
          const won = g.round.winnerId === id;
          return (
            <li key={id} className={`results__row ${won ? 'is-winner' : ''} ${me === id ? 'is-me' : ''}`}>
              <span className="results__place t-mono">{String(i + 1).padStart(2, '0')}</span>
              <div className="results__who">
                <b>
                  <span className="dot" style={{ background: stockBg(s.colour) }} />
                  {s.name}
                  {won && <span className="results__badge">Greenlit</span>}
                </b>
                <em>{rs?.title.trim() || `Untitled ${g.round.genre} Project`}</em>
              </div>
              <div className="results__cats">
                {CATEGORIES.map((c) => (
                  <span key={c.key}>
                    <small>{c.label}</small>
                    <Pips n={card?.[c.key] ?? 0} />
                  </span>
                ))}
              </div>
              <div className="results__total">
                <b>+{cardTotal(card)}</b>
                <small>{points(g, id)} pts</small>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="results__foot">Everyone banks their stamps as points. Most points after the last reel wins the night.</p>
    </section>
  );
}

const stockBg = (colour: string) => stock(colour).bg;

/* ---------------------------------------------------------------------- */
/*  Welcome: the first game on this phone                                  */
/* ---------------------------------------------------------------------- */
const INTRO_KEY = 'greenlit.introSeen';

export function useIntro() {
  const [show, setShow] = useState(() => {
    try {
      return window.localStorage.getItem(INTRO_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const close = () => {
    setShow(false);
    try {
      window.localStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* private window: it'll show again next time, which is fine */
    }
  };
  return { show, open: () => setShow(true), close };
}

export function Intro({ onClose }: { onClose: () => void }) {
  return (
    <div className="scrim intro-scrim" role="dialog" aria-modal="true" aria-labelledby="intro-h">
      <div className="form-sheet dialog intro">
        <div className="t-wide intro__kicker">Before the lights go down</div>
        <h1 id="intro-h" className="t-ticket intro__h">
          Welcome to GREENLIT
        </h1>
        <p className="intro__lede">
          You’re a Hollywood studio, about to pitch a film to <strong>the Commissioner</strong>. (You’ll all take a turn in that chair during the game.)
        </p>
        <ol className="intro__steps">
          <li>
            <b>Build your cast.</b> Bid on actors and actresses from your phone. You’ve got $20M and need five stars. Gold cards are Oscar winners. Black cards are legends from the vault.
          </li>
          <li>
            <b>Find out the genre.</b> Only once everyone has their five do you discover what film you’re making.
          </li>
          <li>
            <b>Do a deal.</b> One trade each on the trading floor, if you fancy it.
          </li>
          <li>
            <b>Write your pitch.</b> Your phone walks you through it, step by step, against the clock: the story, who plays who, the big moment and the title.
          </li>
          <li>
            <b>Pitch it.</b> Two minutes each to sell your film out loud.
          </li>
          <li>
            <b>The Oscar.</b> The Commissioner scores casting, budget and plot. Best film is greenlit. Most points after every reel wins the night.
          </li>
        </ol>
        <button className="btn btn--big btn--go" onClick={onClose}>
          Got it. Roll camera
        </button>
      </div>
    </div>
  );
}
