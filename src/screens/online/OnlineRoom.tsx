import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useRoom, MULTIPLAYER_READY } from '../../net/useRoom';
import type { Room } from '../../net/useRoom';
import type { View } from '../../net/protocol';
import { AUCTION, isRoomCode, makeRoomCode } from '../../net/protocol';
import { PALETTE, PALETTE_KEYS, STUDIO_NAMES, stock } from '../../lib/palette';
import { shuffle } from '../../game/engine';
import { Ticket } from '../../components/Ticket';
import { ScreenView } from './ScreenView';
import { PhoneView } from './PhoneView';
import { ConnectionBadge, ErrorToast, EventToast } from './shared';

const HOST_KEY = 'greenlit.hostRoom';
const readHost = () => {
  try {
    return localStorage.getItem(HOST_KEY);
  } catch {
    return null;
  }
};
const writeHost = (code: string | null) => {
  try {
    if (code) localStorage.setItem(HOST_KEY, code);
    else localStorage.removeItem(HOST_KEY);
  } catch {
    /* fine */
  }
};

/* ====================================================================== */
/*  Hosting: this device becomes the big screen                            */
/* ====================================================================== */
export function HostRoom({ onExit }: { onExit: () => void }) {
  const [code, setCode] = useState(() => readHost() ?? makeRoomCode());
  const [fatal, setFatal] = useState<string | null>(null);
  const onFatal = useCallback((message: string) => {
    if (/taken/i.test(message)) {
      setCode(makeRoomCode());
      return;
    }
    // The saved room has gone (or expired): start a fresh one.
    writeHost(null);
    setFatal(message);
  }, []);
  useEffect(() => {
    if (!fatal) writeHost(code);
  }, [code, fatal]);
  if (!MULTIPLAYER_READY) return <NotReady onExit={onExit} />;
  if (fatal) {
    return (
      <Message title="That room has closed" onExit={onExit}>
        <button
          className="btn btn--big"
          onClick={() => {
            setFatal(null);
            setCode(makeRoomCode());
          }}
        >
          Open a new room
        </button>
      </Message>
    );
  }
  return <Connected key={code} code={code} create onFatal={onFatal} onExit={onExit} />;
}

/* ====================================================================== */
/*  Joining from a phone                                                   */
/* ====================================================================== */
export function JoinRoom({ initialCode, onExit }: { initialCode?: string; onExit: () => void }) {
  const [code, setCode] = useState<string | null>(initialCode && isRoomCode(initialCode) ? initialCode : null);
  const [typed, setTyped] = useState(initialCode ?? '');
  const [fatal, setFatal] = useState<string | null>(null);
  const onFatal = useCallback((message: string) => {
    setFatal(message);
    setCode(null);
  }, []);
  if (!MULTIPLAYER_READY) return <NotReady onExit={onExit} />;
  if (code) return <Connected key={code} code={code} onFatal={onFatal} onExit={onExit} />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = typed.trim().toUpperCase();
    if (!isRoomCode(c)) return setFatal('Room codes are four letters. Check the big screen.');
    setFatal(null);
    setCode(c);
  };
  return (
    <main className="page page--narrow centre-stack join-gate">
      <h1 className="page-title t-ticket">Join a game</h1>
      <p className="lede">Type the four-letter code from the big screen.</p>
      <form className="join-form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="room-code">
          Room code
        </label>
        <input
          id="room-code"
          className="input code-input t-ticket"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={4}
          value={typed}
          onChange={(e) => setTyped(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          placeholder="ABCD"
        />
        <button className="btn btn--big btn--go" type="submit">
          Join
        </button>
      </form>
      {fatal && (
        <div className="notice notice--error" role="alert">
          {fatal}
        </div>
      )}
      <button className="link-btn" onClick={onExit}>
        Back
      </button>
    </main>
  );
}

/* ====================================================================== */
/*  A live connection, routed by who this device is                        */
/* ====================================================================== */
function Connected({ code, create = false, onFatal, onExit }: { code: string; create?: boolean; onFatal: (m: string) => void; onExit: () => void }) {
  const room = useRoom(code, { create, onFatal });
  const view = room.view;
  let body;
  if (!view) {
    body = (
      <main className="page page--narrow centre-stack">
        <p className="lede">{create ? 'Opening the room…' : `Finding room ${code}…`}</p>
      </main>
    );
  } else if (view.you.role === 'screen') {
    body = <ScreenView room={room} view={view} />;
  } else if (view.you.role === 'player' && view.game) {
    body = <PhoneView room={room} view={view} />;
  } else if (view.you.role === 'player') {
    body = <LobbyPhone room={room} view={view} onExit={onExit} />;
  } else {
    body = <Guest room={room} view={view} onExit={onExit} />;
  }
  return (
    <>
      {body}
      <ConnectionBadge status={room.status} />
      <EventToast event={view?.event ?? null} />
      <ErrorToast message={room.error} onDone={room.clearError} />
    </>
  );
}

/* ---------------------------------------------------------------------- */
/*  A phone that hasn't got a studio yet                                   */
/* ---------------------------------------------------------------------- */
function Guest({ room, view, onExit }: { room: Room; view: View; onExit: () => void }) {
  if (!view.game) return <StudioForm room={room} view={view} onExit={onExit} />;
  const g = view.game;
  const now = room.serverNow();
  const free = g.studios.filter((s) => !s.folded && !view.online.includes(s.id));
  const screenGone = !view.online.includes('screen');
  return (
    <main className="page page--narrow centre-stack">
      <h1 className="page-title t-ticket">Game in progress</h1>
      {free.length ? (
        <>
          <p className="lede">Lost your phone, or stepping in for someone? Take over a studio that has gone quiet.</p>
          <div className="studio-rows" style={{ width: 'min(480px, 100%)' }}>
            {free.map((s) => {
              const k = stock(s.colour);
              const quietFor = now - (view.lastSeen[s.id] ?? 0);
              return (
                <button key={s.id} className="studio-row takeover-row" style={{ background: k.bg, color: k.ink }} onClick={() => room.send({ t: 'takeover', studioId: s.id })}>
                  <span className="t-ticket">{s.name}</span>
                  <span className="t-mono">{quietFor < AUCTION.graceMs ? 'Take over' : 'Rescue'}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="lede">Every studio is connected. You can watch on the big screen.</p>
      )}
      {screenGone && (
        <button className="btn btn--ghost" onClick={() => room.send({ t: 'claimScreen' })}>
          The big screen dropped out: make this the big screen
        </button>
      )}
      <button className="link-btn" onClick={onExit}>
        Back
      </button>
    </main>
  );
}

function StudioForm({ room, view, onExit, editing }: { room: Room; view: View; onExit: () => void; editing?: { name: string; colour: string } }) {
  const taken = new Set(view.lobby.filter((l) => l.id !== view.you.studioId).map((l) => l.colour));
  const usedNames = new Set(view.lobby.map((l) => l.name));
  const [name, setName] = useState(editing?.name ?? '');
  const [colour, setColour] = useState(editing?.colour ?? PALETTE_KEYS.find((k) => !taken.has(k)) ?? PALETTE_KEYS[0]);
  const suggest = () => setName(shuffle(STUDIO_NAMES.filter((n) => !usedNames.has(n)))[0] ?? '');
  const k = stock(colour);
  return (
    <main className="page page--narrow centre-stack join-gate">
      <div className="t-wide">Room {view.code}</div>
      <h1 className="page-title t-ticket">{editing ? 'Your studio' : 'Open your studio'}</h1>
      <form
        className="join-form join-form--studio"
        onSubmit={(e) => {
          e.preventDefault();
          room.send({ t: 'join', name, colour });
          if (editing) onExit();
        }}
      >
        <div className="studio-row" style={{ background: k.bg, color: k.ink }}>
          <label className="visually-hidden" htmlFor="studio-name">
            Studio name
          </label>
          <input id="studio-name" className="input input--line" placeholder="Studio name" value={name} maxLength={28} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="icon-btn" aria-label="Suggest a name" onClick={suggest}>
            ↻
          </button>
        </div>
        <div className="swatches swatches--big" role="group" aria-label="Ticket colour">
          {PALETTE_KEYS.map((key) => (
            <button
              type="button"
              key={key}
              className="swatch"
              style={{ background: PALETTE[key].bg }}
              aria-pressed={colour === key}
              aria-label={PALETTE[key].name}
              disabled={taken.has(key)}
              onClick={() => setColour(key)}
            />
          ))}
        </div>
        <button className="btn btn--big btn--go" type="submit" disabled={!name.trim()}>
          {editing ? 'Save changes' : 'Take my seat'}
        </button>
      </form>
      {!editing && (
        <button className="link-btn" onClick={onExit}>
          Back
        </button>
      )}
    </main>
  );
}

function LobbyPhone({ room, view, onExit }: { room: Room; view: View; onExit: () => void }) {
  const mine = view.lobby.find((l) => l.id === view.you.studioId);
  const [edit, setEdit] = useState(false);
  if (!mine) return <StudioForm room={room} view={view} onExit={onExit} />;
  if (edit) return <StudioForm room={room} view={view} onExit={() => setEdit(false)} editing={mine} />;
  const k = stock(mine.colour);
  return (
    <main className="page page--narrow centre-stack">
      <div className="t-wide">Room {view.code}</div>
      <Ticket bg={k.bg} ink={k.ink} className="lobby-stub lobby-stub--mine" serrated>
        <span className="t-ticket lobby-stub__name">{mine.name}</span>
      </Ticket>
      <p className="lede">
        You’re in. {view.lobby.length} {view.lobby.length === 1 ? 'studio' : 'studios'} at the table so far. The big screen rolls camera when everyone’s here.
      </p>
      <button className="link-btn" onClick={() => setEdit(true)}>
        Change name or colour
      </button>
    </main>
  );
}

/* ---------------------------------------------------------------------- */
function NotReady({ onExit }: { onExit: () => void }) {
  return (
    <Message title="Multiplayer is nearly ready" onExit={onExit}>
      <p className="lede">The room server isn’t switched on for this site yet. Pass-the-phone mode works in the meantime.</p>
    </Message>
  );
}

function Message({ title, children, onExit }: { title: string; children?: ReactNode; onExit: () => void }) {
  return (
    <main className="page page--narrow centre-stack">
      <h1 className="page-title t-ticket">{title}</h1>
      {children}
      <button className="link-btn" onClick={onExit}>
        Back to the home screen
      </button>
    </main>
  );
}
