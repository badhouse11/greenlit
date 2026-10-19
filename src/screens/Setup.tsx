import { useMemo, useState } from 'react';
import type { Game } from '../game/types';
import { RULES, createGame, shuffle } from '../game/engine';
import { PALETTE, PALETTE_KEYS, STUDIO_NAMES, stock } from '../lib/palette';
import { Ticket } from '../components/Ticket';
import { useConfirm } from '../components/Confirm';

interface Row {
  name: string;
  colour: string;
}

const freshRows = (n: number): Row[] => {
  const names = shuffle(STUDIO_NAMES);
  return Array.from({ length: n }, (_, i) => ({ name: names[i], colour: PALETTE_KEYS[i] }));
};

export function Setup({
  onStart,
  onCancel,
  hasSaved,
}: {
  onStart: (g: Game) => void;
  onCancel: () => void;
  hasSaved: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() => freshRows(4));
  const [order, setOrder] = useState<number[]>(() => shuffle([0, 1, 2, 3]));
  const [directorsCut, setDirectorsCut] = useState(false);
  const [error, setError] = useState('');
  const { confirm, dialog } = useConfirm();

  const setCount = (n: number) => {
    const clamped = Math.max(RULES.minStudios, Math.min(RULES.maxStudios, n));
    setRows((r) => {
      if (clamped <= r.length) return r.slice(0, clamped);
      const used = new Set(r.map((x) => x.name));
      const spare = shuffle(STUDIO_NAMES.filter((x) => !used.has(x)));
      const usedColours = new Set(r.map((x) => x.colour));
      const spareColours = PALETTE_KEYS.filter((k) => !usedColours.has(k));
      const extra = Array.from({ length: clamped - r.length }, (_, i) => ({
        name: spare[i] ?? `Studio ${r.length + i + 1}`,
        colour: spareColours[i] ?? PALETTE_KEYS[(r.length + i) % PALETTE_KEYS.length],
      }));
      return [...r, ...extra];
    });
    setOrder(shuffle(Array.from({ length: clamped }, (_, i) => i)));
  };

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const duplicateNames = useMemo(() => {
    const seen = rows.map((r) => r.name.trim().toLowerCase()).filter(Boolean);
    return seen.length !== new Set(seen).size;
  }, [rows]);

  const start = () => {
    if (rows.some((r) => !r.name.trim())) return setError('Every studio needs a name on the door.');
    if (duplicateNames) return setError('Two studios share a name. One of them has to rebrand.');
    const go = () => onStart(createGame(rows, { directorsCut }, order));
    if (!hasSaved) return go();
    confirm({
      title: 'Close the game in progress?',
      body: 'Starting a new game closes the current one. Its greenlit films stay in the archive.',
      confirm: 'Start the new game',
      onConfirm: go,
    });
  };

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title t-ticket">Open the studios</h1>
          <p className="lede">Name each studio at the table. Every studio takes a turn as Commissioner, so a game lasts one reel per player.</p>
        </div>
        <button className="btn btn--ghost" onClick={onCancel}>
          Back
        </button>
      </div>

      <div className="setup">
        <section className="form-sheet" aria-labelledby="studios-h">
          <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 id="studios-h" className="form-sheet__title t-ticket" style={{ margin: 0 }}>
              Studios at the table
            </h2>
            <div className="btn-row">
              <button className="icon-btn" onClick={() => setCount(rows.length - 1)} disabled={rows.length <= RULES.minStudios} aria-label="One fewer studio">
                −
              </button>
              <span className="t-ticket" style={{ fontSize: '2rem', minWidth: '1.2em', textAlign: 'center' }} aria-live="polite">
                {rows.length}
              </span>
              <button className="icon-btn" onClick={() => setCount(rows.length + 1)} disabled={rows.length >= RULES.maxStudios} aria-label="One more studio">
                +
              </button>
            </div>
          </div>

          <div className="studio-rows">
            {rows.map((row, i) => {
              const s = stock(row.colour);
              return (
                <div key={i} className="studio-row" style={{ background: s.bg, color: s.ink }}>
                  <span className="studio-row__no">{String(i + 1).padStart(2, '0')}</span>
                  <label>
                    <span className="visually-hidden">Studio {i + 1} name</span>
                    <input className="input input--line" value={row.name} maxLength={28} onChange={(e) => update(i, { name: e.target.value })} />
                  </label>
                  <div className="swatches" role="group" aria-label={`Ticket colour for studio ${i + 1}`}>
                    {PALETTE_KEYS.map((k) => (
                      <button
                        key={k}
                        className="swatch"
                        style={{ background: PALETTE[k].bg }}
                        aria-pressed={row.colour === k}
                        aria-label={PALETTE[k].name}
                        title={PALETTE[k].name}
                        onClick={() => update(i, { colour: k })}
                      />
                    ))}
                  </div>
                  <button
                    className="icon-btn"
                    title="Suggest a name"
                    aria-label={`Suggest a name for studio ${i + 1}`}
                    onClick={() => {
                      const used = new Set(rows.map((r) => r.name));
                      const pick = shuffle(STUDIO_NAMES.filter((n) => !used.has(n)))[0];
                      if (pick) update(i, { name: pick });
                    }}
                  >
                    ↻
                  </button>
                </div>
              );
            })}
          </div>
          <hr className="form-sheet__rule" />
          <label className="toggle">
            <input type="checkbox" checked={directorsCut} onChange={(e) => setDirectorsCut(e.target.checked)} />
            <span>
              <strong>Director’s cut genres.</strong> Adds Heist, Biopic, Superhero, Christmas Film, Sports, Coming-of-Age, Period Drama and Film Noir to the commission pile.
            </span>
          </label>
        </section>

        <aside style={{ display: 'grid', gap: 18 }}>
          <Ticket className="stub" bg="#F4E7CE">
            <h2 className="t-ticket" style={{ fontSize: '1.6rem' }}>
              Commissioner rota
            </h2>
            <ol className="order-list">
              {order.map((idx, r) => (
                <li key={r}>
                  <span className="t-mono">Reel {String(r + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="dot" style={{ background: stock(rows[idx]?.colour).bg }} />
                    {rows[idx]?.name || `Studio ${idx + 1}`}
                  </span>
                </li>
              ))}
            </ol>
            <button className="btn btn--ghost btn--small" onClick={() => setOrder(shuffle(order))}>
              Reshuffle the rota
            </button>
          </Ticket>
          {error && (
            <div className="notice notice--error" role="alert">
              {error}
            </div>
          )}
          <button className="btn btn--big btn--go" onClick={start}>
            Roll camera on reel one
          </button>
        </aside>
      </div>
      {dialog}
    </main>
  );
}
