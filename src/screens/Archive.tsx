import { useMemo, useState } from 'react';
import type { GreenlitFilm } from '../game/types';
import { FilmTicket } from '../components/Cards';
import { CAN_DOWNLOAD, downloadFilmTicket } from '../lib/exportTicket';
import { useConfirm } from '../components/Confirm';

export function Archive({
  films,
  onBack,
  onRemove,
  onClear,
}: {
  films: GreenlitFilm[];
  onBack: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [genre, setGenre] = useState('');
  const [studio, setStudio] = useState('');
  const [sort, setSort] = useState<'new' | 'old'>('new');
  const { confirm, dialog } = useConfirm();

  const genres = useMemo(() => [...new Set(films.map((f) => f.genre))].sort(), [films]);
  const studios = useMemo(() => [...new Set(films.map((f) => f.studioName))].sort(), [films]);

  const shown = useMemo(() => {
    const list = films.filter((f) => (!genre || f.genre === genre) && (!studio || f.studioName === studio));
    const key = (f: GreenlitFilm) => `${f.gameDate}-${String(f.round).padStart(2, '0')}`;
    return list.sort((a, b) => (sort === 'new' ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b))));
  }, [films, genre, studio, sort]);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title t-ticket">The archive</h1>
          <p className="lede">Every picture ever greenlit at this table. {films.length ? `${films.length} and counting.` : ''}</p>
        </div>
        <button className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
      </div>

      {films.length === 0 ? (
        <div className="empty-state">
          <p className="lede">Nothing in the vaults yet. Greenlight a picture and it lands here, cast and all.</p>
        </div>
      ) : (
        <>
          <div className="archive-tools">
            <label className="field">
              <span>Genre</span>
              <select className="select" value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">Every genre</option>
                {genres.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Studio</span>
              <select className="select" value={studio} onChange={(e) => setStudio(e.target.value)}>
                <option value="">Every studio</option>
                {studios.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Order</span>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as 'new' | 'old')}>
                <option value="new">Newest first</option>
                <option value="old">Oldest first</option>
              </select>
            </label>
            <span style={{ flex: 1 }} />
            <button
              className="btn btn--ghost btn--small"
              onClick={() => {
                confirm({
                  title: 'Burn the whole archive?',
                  body: 'Every greenlit film is deleted from this device. This can’t be undone.',
                  confirm: 'Burn it',
                  onConfirm: onClear,
                });
              }}
            >
              Clear the archive
            </button>
          </div>

          {shown.length === 0 ? (
            <p className="muted">No films match those filters.</p>
          ) : (
            <div className="archive-grid">
              {shown.map((f) => (
                <article key={f.id} className="archive-item">
                  <FilmTicket film={f} stamped compact />
                  <div className="archive-item__foot">
                    <span className="muted">
                      {new Date(f.gameDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <span className="btn-row" style={{ gap: 14 }}>
                      {CAN_DOWNLOAD && (
                        <button className="link-btn" onClick={() => downloadFilmTicket(f)}>
                          Download ticket
                        </button>
                      )}
                      <button
                        className="link-btn"
                        onClick={() => {
                          confirm({
                            title: `Remove “${f.title}”?`,
                            body: 'It comes out of the archive on this device.',
                            confirm: 'Remove it',
                            onConfirm: () => onRemove(f.id),
                          });
                        }}
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {dialog}
    </main>
  );
}
