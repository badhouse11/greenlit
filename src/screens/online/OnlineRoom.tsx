import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useRoom, MULTIPLAYER_READY } from '../../net/useRoom';
import type { Room } from '../../net/useRoom';
import type { View } from '../../net/protocol';
import { AUCTION, isRoomCode, makeRoomCode } from '../../net/protocol';
import { RULES, shuffle } from '../../game/engine';
import { PALETTE, PALETTE_KEYS, STUDIO_NAMES, stock } from '../../lib/palette';
import { Ticket } from '../../components/Ticket';
import { ScreenView } from './ScreenView';
import { PhoneView } from './PhoneView';
import { ConnectionBadge, ErrorToast, EventToast, ShareInvite } from './shared';

const START_KEY = 'greenlit.startedRoom';
const readStarted = () => {
  try {
    return localStorage.getItem(START_KEY);
  } catch {
    return null;
  }
};
const writeStarted = (code: string | null) => {
  try {
    if (code) localStorage.setItem(START_KEY, code);
    else localStorage.removeItem(START_KEY);
  } catch {
    /* fine */
  }
};

/* ====================================================================== */
/*  Start a game: this phone opens the room, hosts it and plays            */
/* ====================================================================== */
export function StartRoom({ onExit }: { onExit: () => void }) {
  const [code, setCode] = useState(() => readStarted() ?? makeRoomCode());
  const [fatal, setFatal] = useState<string | null>(null);
  const onFatal = useCallback((message: string) => {
    if (/taken/i.test(message)) {
      setCode(makeRoomCode());
      return;
    }
    writeStarted(null);
    setFatal(message);
  }, []);
  useEffect(() => {
    if (!fatal) writeStarted(code);
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
          Start a new game
        </button>
      </Message>
    );
  }
  return (
    <Connected
      key={code}
      code={code}
      create
      onFatal={onFatal}
      onExit={() => {
        writeStarted(null);
        onExit();
      }}
    />
  );
}

/* ====================================================================== */
/*  Join a game, or watch one on a big screen                              */
/* ====================================================================== */
export function JoinRoom({ initialCode, watch = false, onExit }: { initialCode?: string; watch?: boolean; onExit: () => void }) {
  const [code, setCode] = useState<string | null>(initialCode && isRoomCode(initialCode) ? initialCode : null);
  const [typed, setTyped] = useState(initialCode ?? '');
  const [fatal, setFatal] = useState<string | null>(null);
  const onFatal = useCallback((message: string) => {
    setFatal(message);
    setCode(null);
  }, []);
  if (!MULTIPLAYER_READY) return <NotReady onExit={onExit} />;
  if (code) return <Connected key={code} code={code} watch={watch} onFatal={onFatal} onExit={onExit} />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = typed.trim().toUpperCase();
    if (!isRoomCode(c)) return setFatal('Room codes are four letters. Ask whoever started the game.');
    setFatal(null);
    setCode(c);
  };
  return (
    <main className="page page--narrow centre-stack join-gate">
      <h1 className="page-title t-ticket">{watch ? 'Watch on a big screen' : 'Join a game'}</h1>
      <p className="lede">
        {watch
          ? 'Put the game on a laptop or TV for the whole table to see. Type the code from any player’s phone.'
          : 'Type the four-letter code from the phone that started the game. Or just tap their invite link.'}
      </p>
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
          {watch ? 'Show the game' : 'Join'}
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
function Connected({
  code,
  create = false,
  watch = false,
  onFatal,
  onExit,
}: {
  code: string;
  create?: boolean;
  watch?: boolean;
  onFatal: (m: string) => void;
  onExit: () => void;
}) {
  const room = useRoom(code, { create, onFatal });
  const view = room.view;
  const asked = useRef(false);

  // A big screen announces itself once it has said hello.
  useEffect(() => {
    if (watch && view?.you.role === 'guest' && !asked.current) {
      asked.current = true;
      room.send({ t: 'watch' });
    }
  }, [watch, view?.you.role, room]);

  let body;
  if (!view) {
    body = (
      <main className="page page--narrow centre-stack">
        <p className="lede">{create ? 'Opening your room…' : `Finding room ${code}…`}</p>
      </main>
    );
  } else if (view.you.role === 'screen') {
    body = <ScreenView room={room} view={view} />;
  } else if (watch) {
    body = (
      <main className="page page--narrow centre-stack">
        <p className="lede">Setting up the big screen…</p>
      </main>
    );
  } else if (view.you.role === 'player' && view.game) {
    body = <PhoneView room={room} view={view} />;
  } else if (!view.game) {
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
/*  A phone arriving mid-game                                              */
/* ---------------------------------------------------------------------- */
function Guest({ room, view, onExit }: { room: Room; view: View; onExit: () => void }) {
  const g = view.game!;
  const now = room.serverNow();
  const free = g.studios.filter((s) => !s.folded && !view.online.includes(s.id));
  return (
    <main className="page page--narrow centre-stack">
      <div className="t-wide">Room {view.code}</div>
      <h1 className="page-title t-ticket">Game in progress</h1>
      {free.length ? (
        <>
          <p className="lede">Phone died, or stepping in for someone? Take over a studio that has gone quiet.</p>
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
        <p className="lede">Every studio is connected. Join the next game, or ask the host to put it on a big screen.</p>
      )}
      <button className="link-btn" onClick={onExit}>
        Back
      </button>
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/*  Before the game: open your studio, wait for the host                   */
/* ---------------------------------------------------------------------- */
function StudioForm({ room, view, onDone, editing }: { room: Room; view: View; onDone: () => void; editing?: { name: string; colour: string } }) {
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
          if (editing) onDone();
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
      <button className="link-btn" onClick={onDone}>
        {editing ? 'Cancel' : 'Back'}
      </button>
    </main>
  );
}

function LobbyPhone({ room, view, onExit }: { room: Room; view: View; onExit: () => void }) {
  const mine = view.lobby.find((l) => l.id === view.you.studioId);
  const [edit, setEdit] = useState(false);
  const [directorsCut, setDirectorsCut] = useState(false);
  if (!mine) return <StudioForm room={room} view={view} onDone={onExit} />;
  if (edit) return <StudioForm room={room} view={view} onDone={() => setEdit(false)} editing={mine} />;
  const n = view.lobby.length;
  const hostName = view.lobby.find((l) => l.id === view.host.studioId)?.name;
  return (
    <main className="page page--narrow centre-stack lobby-phone">
      <Ticket className="code-ticket code-ticket--phone">
        <div className="t-wide code-ticket__kicker">Room code</div>
        <div className="code-ticket__code t-ticket">{view.code}</div>
        <ShareInvite code={view.code} />
      </Ticket>

      <section className="lobby-phone__list">
        <h2 className="t-ticket lobby__h">
          Studios at the table <span className="muted">{n}/{RULES.maxStudios}</span>
        </h2>
        <div className="lobby-grid lobby-grid--phone">
          {view.lobby.map((l) => {
            const k = stock(l.colour);
            const on = view.online.includes(l.id);
            return (
              <Ticket key={l.id} bg={k.bg} ink={k.ink} className="lobby-stub" serrated>
                <span className="t-ticket lobby-stub__name">
                  {l.name}
                  {l.id === mine.id ? ' (you)' : ''}
                </span>
                {view.you.isHost && !on && l.id !== mine.id && (
                  <button className="link-btn" onClick={() => room.act({ a: 'fold', studioId: l.id })}>
                    Remove
                  </button>
                )}
              </Ticket>
            );
          })}
        </div>
      </section>

      {view.you.isHost ? (
        <section className="lobby-phone__start">
          <label className="toggle">
            <input type="checkbox" checked={directorsCut} onChange={(e) => setDirectorsCut(e.target.checked)} />
            <span>
              <strong>Director’s cut genres.</strong> Adds Heist, Biopic, Superhero and more.
            </span>
          </label>
          <button className="btn btn--big btn--go" disabled={n < RULES.minStudios} onClick={() => room.send({ t: 'start', settings: { directorsCut } })}>
            {n < RULES.minStudios ? `Need ${RULES.minStudios - n} more ${RULES.minStudios - n === 1 ? 'studio' : 'studios'}` : 'Roll camera'}
          </button>
          <p className="phone-small">You’re the host. You start the game and look after the housekeeping. You play like everyone else.</p>
        </section>
      ) : (
        <p className="lede">You’re in. {hostName ? `${hostName} rolls camera` : 'The host rolls camera'} when everyone’s here.</p>
      )}

      <p className="phone-small">
        Got a laptop or TV? Open <strong>{window.location.host}</strong>, tap <strong>Watch on a big screen</strong> and type {view.code}. Optional, but lovely.
      </p>
      <button className="link-btn" onClick={() => setEdit(true)}>
        Change your studio’s name or colour
      </button>
    </main>
  );
}

/* ---------------------------------------------------------------------- */
function NotReady({ onExit }: { onExit: () => void }) {
  return (
    <Message title="Multiplayer is nearly ready" onExit={onExit}>
      <p className="lede">The game server isn’t switched on for this site yet. Pass-the-phone mode works in the meantime.</p>
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

