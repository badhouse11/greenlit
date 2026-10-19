import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, ClientMsg, ServerMsg, View } from './protocol';

/** The room server's address, set in Netlify as VITE_ROOM_SERVER. */
export const ROOM_SERVER: string = (import.meta.env.VITE_ROOM_SERVER ?? '').replace(/\/+$/, '');
export const MULTIPLAYER_READY = ROOM_SERVER.length > 0;

const seatKey = (code: string) => `greenlit.seat.${code}`;

export const loadSeat = (code: string) => {
  try {
    return localStorage.getItem(seatKey(code));
  } catch {
    return null;
  }
};

const saveSeat = (code: string, token: string | null) => {
  try {
    if (token) localStorage.setItem(seatKey(code), token);
    else localStorage.removeItem(seatKey(code));
  } catch {
    /* private browsing: rejoining after a refresh won't be automatic */
  }
};

export type Status = 'connecting' | 'open' | 'reconnecting' | 'gone';

export interface Room {
  status: Status;
  view: View | null;
  error: string | null;
  /** Server time now, corrected for this device's clock. */
  serverNow: () => number;
  send: (msg: ClientMsg) => void;
  act: (action: Action) => void;
  clearError: () => void;
}

const wsUrl = (code: string) => `${ROOM_SERVER.replace(/^http/, 'ws')}/room/${code}`;

export function useRoom(code: string | null, opts: { create?: boolean; onFatal?: (message: string) => void } = {}): Room {
  const [status, setStatus] = useState<Status>('connecting');
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const offset = useRef(0);
  const createRef = useRef(!!opts.create);
  const fatalRef = useRef(opts.onFatal);
  fatalRef.current = opts.onFatal;

  useEffect(() => {
    if (!code) return;
    let alive = true;
    let attempt = 0;
    let pinger: number | undefined;
    let retry: number | undefined;
    let welcomed = false;

    const connect = () => {
      if (!alive) return;
      setStatus(attempt === 0 ? 'connecting' : 'reconnecting');
      const sock = new WebSocket(wsUrl(code));
      ws.current = sock;

      sock.onopen = () => {
        attempt = 0;
        sock.send(JSON.stringify({ t: 'hello', token: loadSeat(code), create: createRef.current && !loadSeat(code) } satisfies ClientMsg));
        window.clearInterval(pinger);
        pinger = window.setInterval(() => {
          if (sock.readyState === WebSocket.OPEN) sock.send('{"t":"ping"}');
        }, 20000);
      };

      sock.onmessage = (ev) => {
        let msg: ServerMsg;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (msg.t === 'welcome') {
          welcomed = true;
          createRef.current = false;
          if (msg.token) saveSeat(code, msg.token);
          setStatus('open');
        } else if (msg.t === 'state') {
          offset.current = msg.view.serverNow - Date.now();
          setView(msg.view);
          setStatus('open');
        } else if (msg.t === 'error') {
          if (!welcomed) {
            alive = false;
            setStatus('gone');
            fatalRef.current?.(msg.message);
            sock.close();
            return;
          }
          setError(msg.message);
        }
      };

      sock.onclose = () => {
        window.clearInterval(pinger);
        if (!alive) return;
        welcomed = false;
        attempt += 1;
        setStatus('reconnecting');
        retry = window.setTimeout(connect, Math.min(8000, 500 * 2 ** Math.min(attempt, 4)));
      };
    };

    connect();
    const wake = () => {
      if (document.visibilityState === 'visible' && ws.current && ws.current.readyState > 1) {
        window.clearTimeout(retry);
        connect();
      }
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      alive = false;
      window.clearInterval(pinger);
      window.clearTimeout(retry);
      document.removeEventListener('visibilitychange', wake);
      ws.current?.close();
    };
  }, [code]);

  const send = useCallback((msg: ClientMsg) => {
    const sock = ws.current;
    if (sock && sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(msg));
    else setError('Reconnecting to the room. Try again in a second.');
  }, []);

  const act = useCallback((action: Action) => send({ t: 'act', action }), [send]);

  return {
    status,
    view,
    error,
    serverNow: () => Date.now() + offset.current,
    send,
    act,
    clearError: () => setError(null),
  };
}

/** Re-renders every `ms` so countdowns tick smoothly. */
export function useTicker(active: boolean, ms = 250) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setN((n) => n + 1), ms);
    return () => window.clearInterval(t);
  }, [active, ms]);
}
