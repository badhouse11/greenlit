/**
 * The room this device was last in, so a refresh or a closed tab can get back to it.
 * Leaving a game forgets it, so nobody is ever dragged back into an old game.
 */
const KEY = 'greenlit.lastRoom';
const OLD_START_KEY = 'greenlit.startedRoom'; // older builds reopened this on "Start a game"
const MAX_AGE = 12 * 60 * 60 * 1000;

export interface LastRoom {
  code: string;
  at: number;
}

export function rememberRoom(code: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() } satisfies LastRoom));
  } catch {
    /* private window: no rejoin shortcut, which is fine */
  }
}

export function lastRoom(): LastRoom | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as LastRoom;
    if (!r?.code || Date.now() - r.at > MAX_AGE) return null;
    return r;
  } catch {
    return null;
  }
}

/** Forget the remembered room. With a code, only if that's the room being left. */
export function forgetRoom(code?: string) {
  try {
    if (code && lastRoom()?.code !== code) {
      clearRoomFromAddress();
      return;
    }
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_START_KEY);
  } catch {
    /* fine */
  }
  clearRoomFromAddress();
}

/** Puts ?room=CODE in the address bar, so a refresh lands back in the game. */
export function putRoomInAddress(code: string) {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('room') === code) return;
    url.searchParams.set('room', code);
    window.history.replaceState(null, '', url.toString());
  } catch {
    /* fine */
  }
}

export function clearRoomFromAddress() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('room')) return;
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
  } catch {
    /* fine */
  }
}
