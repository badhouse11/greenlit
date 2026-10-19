import { useEffect, useRef, useState } from 'react';
import type { Game } from '../../game/types';
import type { Auction, Clock, RoomEvent, View } from '../../net/protocol';
import { AUCTION } from '../../net/protocol';
import { studioById } from '../../game/engine';
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

export const PROMPTS = [
  { head: 'A title', body: 'Say it like it’s already on the poster.' },
  { head: 'A logline', body: 'One sentence: who wants what, and what’s standing in the way.' },
  { head: 'All five stars', body: 'Who’s the lead? Who’s the villain? Who dies in the first ten minutes?' },
  { head: 'Own the genre', body: 'However wrong your cast is for it. Especially then.' },
  { head: 'The money shot', body: 'The one scene the trailer is built around.' },
  { head: 'The budget', body: 'Came in under? Brag about it. The Commissioner is counting.' },
];

export const ordinal = (n: number) => ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'][n - 1] ?? `#${n}`;

/** Live auction numbers, from the server's clock. */
export function auctionState(a: Auction, now: number) {
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
