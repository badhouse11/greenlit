import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { RoundStudio } from '../../game/types';
import type { Room } from '../../net/useRoom';
import { useTicker } from '../../net/useRoom';
import type { PitchNotes, View } from '../../net/protocol';
import { PREP_MS, PREP_STEPS, emptyNotes, prepStepAt, prepStepLeft } from '../../net/protocol';
import { clockLeft, mmss, ordinal } from './shared';

/* ---------------------------------------------------------------------- */
/*  The words on each step: plain English, with one example film           */
/* ---------------------------------------------------------------------- */
export const EXAMPLE_FILM = 'The Last Ferry';

export const PREP_COPY = {
  oneLiner: {
    ask: 'Sum up your film in one sentence.',
    help: 'Who is it about, what do they want, and what’s in their way?',
    placeholder: 'When…, a… must…',
    example: 'When the last ferry off a remote Scottish island breaks down, a suspended detective has one night to find a killer among the stranded passengers.',
  },
  start: {
    ask: 'How does it start?',
    placeholder: 'Who are we following, and where?',
    example: 'A detective, suspended from the force, heads home to the island for her father’s funeral.',
  },
  middle: {
    ask: 'What goes wrong?',
    placeholder: 'The problem that turns everything upside down.',
    example: 'A storm hits, the engine dies, and the captain is found dead in his cabin. Everyone on board is a suspect.',
  },
  end: {
    ask: 'How does it end?',
    placeholder: 'Do they win? What does it cost them?',
    example: 'She unmasks the killer at dawn as the rescue boat arrives, and earns her badge back.',
  },
  roles: {
    ask: 'Give each of your five stars a part.',
    help: 'Who’s the hero? Who’s the villain? Who doesn’t make it to the end?',
    placeholder: 'plays…',
    example: 'Florence Pugh plays the suspended detective. Bill Nighy plays the ship’s chaplain: charming, and hiding something.',
  },
  bigMoment: {
    ask: 'The scene everyone will talk about.',
    help: 'The bit they’d put in the trailer.',
    placeholder: 'Describe the moment.',
    example: 'The engine room floods while the detective fights the killer in the dark, lit only by a flare.',
  },
  title: {
    ask: 'What’s your film called?',
    help: 'Short and punchy beats clever. Say it like it’s already on the poster.',
    placeholder: 'Your title',
    example: EXAMPLE_FILM,
  },
};

function Example({ children }: { children: ReactNode }) {
  return (
    <details className="example">
      <summary>Show me an example</summary>
      <p>
        <span className="example__label">From “{EXAMPLE_FILM}”, a thriller:</span> {children}
      </p>
    </details>
  );
}

function Area({ label, value, onChange, placeholder, rows = 3, max }: { label: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; max: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea className="textarea textarea--note" rows={rows} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/* ---------------------------------------------------------------------- */
/*  The prep clock, shared by the whole room                               */
/* ---------------------------------------------------------------------- */
export function usePrepClock(room: Room, view: View) {
  const left = clockLeft(view.prep, room.serverNow());
  const running = !!view.prep.runningSince && left > 0;
  useTicker(running, 500);
  const used = PREP_MS - left;
  return { left, used, running, roomStep: prepStepAt(used) };
}

/* ---------------------------------------------------------------------- */
/*  A pitching studio's phone during prep: one timed step at a time        */
/* ---------------------------------------------------------------------- */
export function PrepNotes({ room, view, rs }: { room: Room; view: View; rs: RoundStudio }) {
  const g = view.game!;
  const { left, used, running, roomStep } = usePrepClock(room, view);
  const [mine, setMine] = useState(0);
  const step = Math.max(mine, roomStep);
  const [notes, setNotes] = useState<PitchNotes>(() => ({ ...emptyNotes(), ...(view.notes ?? {}), roles: { ...(view.notes?.roles ?? {}) } }));
  const [title, setTitle] = useState(rs.title);
  const dirty = useRef(false);
  const titleDirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) return;
    const t = window.setTimeout(() => room.act({ a: 'notes', notes }), 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);
  useEffect(() => {
    if (!titleDirty.current) return;
    const t = window.setTimeout(() => room.act({ a: 'title', title }), 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const edit = (patch: Partial<PitchNotes>) => {
    dirty.current = true;
    setNotes((n) => ({ ...n, ...patch }));
  };
  const editRole = (id: string, v: string) => {
    dirty.current = true;
    setNotes((n) => ({ ...n, roles: { ...n.roles, [id]: v } }));
  };
  const editTitle = (v: string) => {
    titleDirty.current = true;
    setTitle(v);
  };

  const done = step >= PREP_STEPS.length;
  const pencilsDown = left === 0;
  const position = g.round.pitchOrder.indexOf(view.you.studioId!) + 1;

  const fields: Record<string, ReactNode> = {
    oneLiner: (
      <>
        <Area label={PREP_COPY.oneLiner.ask} value={notes.oneLiner} onChange={(v) => edit({ oneLiner: v })} placeholder={PREP_COPY.oneLiner.placeholder} max={200} />
        <p className="phone-small">{PREP_COPY.oneLiner.help}</p>
        {!done && <Example>{PREP_COPY.oneLiner.example}</Example>}
      </>
    ),
    story: (
      <>
        <Area label={PREP_COPY.start.ask} value={notes.start} onChange={(v) => edit({ start: v })} placeholder={PREP_COPY.start.placeholder} rows={2} max={400} />
        <Area label={PREP_COPY.middle.ask} value={notes.middle} onChange={(v) => edit({ middle: v })} placeholder={PREP_COPY.middle.placeholder} rows={2} max={400} />
        <Area label={PREP_COPY.end.ask} value={notes.end} onChange={(v) => edit({ end: v })} placeholder={PREP_COPY.end.placeholder} rows={2} max={400} />
        {!done && (
          <Example>
            {PREP_COPY.start.example} {PREP_COPY.middle.example} {PREP_COPY.end.example}
          </Example>
        )}
      </>
    ),
    roles: (
      <>
        {!done && <p className="phone-small">{PREP_COPY.roles.help}</p>}
        <div className="roles">
          {rs.cast.map((c) => (
            <label key={c.id} className="field role-field">
              <span>
                {c.name}
                {c.oscar && <span className="oscar-mark">Oscar</span>}
                {c.deck === 'legacy' && <span className="legacy-mark">Vault</span>}
              </span>
              <input className="input" value={notes.roles[c.id] ?? ''} maxLength={120} placeholder={PREP_COPY.roles.placeholder} onChange={(e) => editRole(c.id, e.target.value)} />
            </label>
          ))}
        </div>
        {!done && <Example>{PREP_COPY.roles.example}</Example>}
      </>
    ),
    bigMoment: (
      <>
        <Area label={PREP_COPY.bigMoment.ask} value={notes.bigMoment} onChange={(v) => edit({ bigMoment: v })} placeholder={PREP_COPY.bigMoment.placeholder} max={300} />
        {!done && <p className="phone-small">{PREP_COPY.bigMoment.help}</p>}
        {!done && <Example>{PREP_COPY.bigMoment.example}</Example>}
      </>
    ),
    title: (
      <>
        <label className="field">
          <span>{PREP_COPY.title.ask}</span>
          <input id="film-title" className="input input--title" value={title} maxLength={60} placeholder={PREP_COPY.title.placeholder} onChange={(e) => editTitle(e.target.value)} />
        </label>
        {!done && <p className="phone-small">{PREP_COPY.title.help}</p>}
        {!done && <Example>{PREP_COPY.title.example}</Example>}
      </>
    ),
  };

  const timer = pencilsDown
    ? 'Pencils down'
    : !running
      ? `Clock paused · ${mmss(left)} left`
      : step === roomStep
        ? `${mmss(prepStepLeft(used, step))} left on this step`
        : `You’re ahead · pencils down in ${mmss(left)}`;

  return (
    <section className="phone-stack prep-phone">
      <div className="prep-head">
        <p className="lede">
          A <strong>{g.round.genre.toLowerCase()}</strong> starring all five. You pitch {ordinal(position).toLowerCase()}.
        </p>
        <ol className="prep-steps" aria-label="Pitch prep steps">
          {PREP_STEPS.map((s, i) => (
            <li key={s.key} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>
        <div className={`prep-timer ${!pencilsDown && step === roomStep && prepStepLeft(used, step) <= 15000 ? 'is-urgent' : ''}`} role="timer">
          {timer}
        </div>
      </div>

      {!done ? (
        <div className="prep-step">
          <div className="t-wide prep-step__kicker">
            Step {step + 1} of {PREP_STEPS.length} · {PREP_STEPS[step].minutes} {PREP_STEPS[step].minutes === 1 ? 'minute' : 'minutes'}
          </div>
          <h1 className="t-ticket phone-title">{PREP_STEPS[step].label}</h1>
          {fields[PREP_STEPS[step].key]}
          <div className="btn-row">
            {step > roomStep && (
              <button className="btn btn--ghost" onClick={() => setMine(step - 1)}>
                Back
              </button>
            )}
            <button className="btn btn--go" onClick={() => setMine(step + 1)}>
              {step === PREP_STEPS.length - 1 ? 'Done: see my notes' : 'Done: next step'}
            </button>
          </div>
        </div>
      ) : (
        <div className="prep-review">
          <h1 className="t-ticket phone-title">{pencilsDown ? 'Pencils down' : 'Your pitch notes'}</h1>
          <p className="phone-small">
            {pencilsDown ? 'These stay on your phone while you pitch. Nobody else sees them.' : `Still ${mmss(left)} to polish. These stay on your phone while you pitch.`}
          </p>
          {fields.title}
          {fields.oneLiner}
          <h2 className="t-ticket phone-h2">The story</h2>
          {fields.story}
          <h2 className="t-ticket phone-h2">Who plays who</h2>
          {fields.roles}
          {fields.bigMoment}
          <p className="notice">
            You spent <b>${rs.startBudget - rs.budget}M</b> of ${rs.startBudget}M. Came in under? Brag about it.
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/*  Your notes while you pitch: read-only, big and clear                   */
/* ---------------------------------------------------------------------- */
export function NotesSheet({ notes, rs, title }: { notes: PitchNotes | null; rs: RoundStudio; title: string }) {
  const n = notes ?? emptyNotes();
  const line = (label: string, text: string) =>
    text.trim() ? (
      <div className="notes-sheet__item">
        <span className="t-wide">{label}</span>
        <p>{text}</p>
      </div>
    ) : null;
  const empty = !n.oneLiner.trim() && !n.start.trim() && !n.middle.trim() && !n.end.trim() && !n.bigMoment.trim() && !Object.values(n.roles).some((r) => r.trim());
  return (
    <div className="notes-sheet">
      <div className="notes-sheet__title t-ticket">{title}</div>
      {empty && <p className="phone-small">No notes this time. Wing it, with confidence.</p>}
      {line('In one sentence', n.oneLiner)}
      {line('How it starts', n.start)}
      {line('What goes wrong', n.middle)}
      {line('How it ends', n.end)}
      <div className="notes-sheet__item">
        <span className="t-wide">Who plays who</span>
        <ul className="notes-sheet__cast">
          {rs.cast.map((c) => (
            <li key={c.id}>
              <b>{c.name}</b> {n.roles[c.id]?.trim() ? n.roles[c.id] : <span className="muted">(no part yet)</span>}
            </li>
          ))}
        </ul>
      </div>
      {line('The big moment', n.bigMoment)}
      <div className="notes-sheet__item">
        <span className="t-wide">The budget</span>
        <p>
          Spent ${rs.startBudget - rs.budget}M of ${rs.startBudget}M.
        </p>
      </div>
    </div>
  );
}
