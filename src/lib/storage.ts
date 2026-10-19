import type { Game, GreenlitFilm } from '../game/types';

const GAME_KEY = 'greenlit.game.v1';
const ARCHIVE_KEY = 'greenlit.archive.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the game still plays, it just won't survive a refresh */
  }
}

/** Saves from before the scoring update can't resume; start those fresh. */
export const loadGame = () => {
  const g = read<Game | null>(GAME_KEY, null);
  if (!g || !g.points || !g.round?.scores || !Array.isArray(g.round.legacySlots)) return null;
  return g;
};
export const saveGame = (g: Game | null) => write(GAME_KEY, g);

export const loadArchive = () => read<GreenlitFilm[]>(ARCHIVE_KEY, []);
export const saveArchive = (films: GreenlitFilm[]) => write(ARCHIVE_KEY, films);

/**
 * Mirror one game's films into the long-running archive.
 * Films from that game that no longer exist (an undone greenlight) are dropped.
 */
export function mergeIntoArchive(archive: GreenlitFilm[], gameId: string, films: GreenlitFilm[]): GreenlitFilm[] {
  const keep = new Set(films.map((f) => f.id));
  const pruned = archive.filter((f) => f.gameId !== gameId || keep.has(f.id));
  let changed = pruned.length !== archive.length;
  const byId = new Map(pruned.map((f) => [f.id, f]));
  for (const f of films) {
    const prev = byId.get(f.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(f)) {
      byId.set(f.id, f);
      changed = true;
    }
  }
  return changed ? [...byId.values()] : archive;
}
