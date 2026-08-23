// Fuse search configuration shared by the catalogue and any future search UI.

import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';

export interface SearchableBook {
  _id: string;
  title?: string | null;
  authors?: string[] | null;
  isbn?: string | null;
  description?: string | null;
  publisher?: string | null;
  language?: string | null;
  series?: string | null;
  categories?: Array<{ title?: string | null; slug?: string | null } | null> | null;
  collectionTitles?: string[] | null;
}

export const FUSE_OPTIONS: IFuseOptions<SearchableBook> = {
  includeScore: true,
  threshold: 0.38,
  minMatchCharLength: 2,
  ignoreLocation: true,
  keys: [
    { name: 'title',              weight: 1.0 },
    { name: 'isbn',               weight: 0.9 },
    { name: 'authors',            weight: 0.8 },
    { name: 'series',             weight: 0.6 },
    { name: 'categories.title',   weight: 0.5 },
    { name: 'collectionTitles',   weight: 0.4 },
    { name: 'publisher',          weight: 0.4 },
    { name: 'language',           weight: 0.3 },
  ],
};

export function buildFuseIndex(books: SearchableBook[]): Fuse<SearchableBook> {
  return new Fuse(books, FUSE_OPTIONS);
}

export function fuseSearch(fuse: Fuse<SearchableBook>, query: string): SearchableBook[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return fuse.search(trimmed).map(result => result.item);
}
