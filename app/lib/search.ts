// Fuse.js-powered search for books.
// Import and use buildFuseIndex + fuseSearch anywhere books are searched.

import Fuse from 'fuse.js';

export interface SearchableBook {
  _id: string;
  title?: string | null;
  author?: string | null;
  isbn?: string | null;
  description?: string | null;
  publisher?: string | null;
  language?: string | null;
  series?: string | null;
  categories?: Array<{ title?: string | null; slug?: string | null }> | null;
  // Injected client-side from collection membership
  collectionTitles?: string[];
  price: number;
  stock?: number | null;
  [key: string]: any;
}

export const FUSE_OPTIONS: Fuse.IFuseOptions<SearchableBook> = {
  includeScore: true,
  // 0 = exact match only, 1 = match anything. 0.4 allows reasonable typos.
  threshold: 0.4,
  minMatchCharLength: 2,
  // Matches anywhere in the string score equally (important for transliterated Urdu titles).
  ignoreLocation: true,
  keys: [
    { name: 'title',              weight: 1.0 },
    { name: 'isbn',               weight: 0.9 },
    { name: 'author',             weight: 0.8 },
    { name: 'series',             weight: 0.6 },
    { name: 'categories.title',   weight: 0.5 },
    { name: 'collectionTitles',   weight: 0.4 },
    { name: 'publisher',          weight: 0.4 },
    { name: 'language',           weight: 0.3 },
    { name: 'description',        weight: 0.3 },
  ],
};

export function buildFuseIndex(books: SearchableBook[]): Fuse<SearchableBook> {
  return new Fuse(books, FUSE_OPTIONS);
}

/**
 * Run a search query. Returns items in Fuse relevance order (best match first).
 * Returns empty array for blank queries so callers can fall back to all books.
 */
export function fuseSearch(fuse: Fuse<SearchableBook>, query: string): SearchableBook[] {
  const q = (query ?? '').trim();
  if (!q) return [];
  return fuse.search(q).map(r => r.item);
}
