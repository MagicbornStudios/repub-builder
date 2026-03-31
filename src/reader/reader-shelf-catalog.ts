import type { ReaderBookEntry } from './types';

/** Stored filter: `'all'` or an exact genre string from a book’s `genres` array. */
export type ShelfCatalogFilter = string;

export const READER_SHELF_FILTER_STORAGE_KEY = 'reader-shelf-catalog-filter';

const LEGACY_PROGRESS_FILTERS = new Set(['ready', 'queued', 'reading', 'new', 'done']);

/**
 * Unique non-empty genres across all catalog rows, sorted for stable chip order.
 */
export function collectDistinctGenres(books: ReaderBookEntry[]): string[] {
  const set = new Set<string>();
  for (const b of books) {
    for (const g of b.genres ?? []) {
      const t = g.trim();
      if (t) set.add(t);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * Normalize a value from localStorage: drop legacy progress filters; unknown genres → `all`.
 */
export function normalizeShelfCatalogFilter(raw: string | null, knownGenres: string[]): ShelfCatalogFilter {
  if (raw == null || raw === '' || raw === 'all') return 'all';
  if (LEGACY_PROGRESS_FILTERS.has(raw)) return 'all';
  if (knownGenres.includes(raw)) return raw;
  return 'all';
}

/**
 * Split manifest rows into built EPUBs vs queued (no EPUB).
 */
export function partitionShelfBooks(books: ReaderBookEntry[]) {
  const builtIn = books.filter((b) => b.hasEpub);
  const queued = books.filter((b) => !b.hasEpub);
  return { builtIn, queued };
}

function bookHasGenre(book: ReaderBookEntry, genre: string): boolean {
  return (book.genres ?? []).some((g) => g.trim() === genre);
}

/**
 * Filter by selected genre (`all` keeps both sections). Books with no matching genre are hidden when a genre is active.
 */
export function applyShelfCatalogFilter(
  builtInBooks: ReaderBookEntry[],
  queuedBooks: ReaderBookEntry[],
  filter: ShelfCatalogFilter,
): { builtIn: ReaderBookEntry[]; queued: ReaderBookEntry[] } {
  if (filter === 'all') {
    return { builtIn: builtInBooks, queued: queuedBooks };
  }
  return {
    builtIn: builtInBooks.filter((b) => bookHasGenre(b, filter)),
    queued: queuedBooks.filter((b) => bookHasGenre(b, filter)),
  };
}
