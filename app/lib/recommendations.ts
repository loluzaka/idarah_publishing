// Shared utility for search history, recently viewed books, and recommendation scoring.
// All state is localStorage-only — no Sanity schema changes required.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecentlyViewedBook {
  _id: string;
  title: string;
  author?: string | null;
  series?: string | null;
  publisher?: string | null;
  categories?: Array<{ _id?: string; title?: string; slug?: string | { current: string } | null } | null> | null;
  viewedAt?: number;
}

// Minimal book shape needed for scoring. Author may arrive as a string (dereferenced name),
// an object with a `.name`, or null when the reference is missing.
export interface ScoredBook {
  _id: string;
  title?: string | null;
  author?: string | { name?: string | null } | null;
  series?: string | null;
  publisher?: string | null;
  description?: string | null;
  categories?: Array<{ _id?: string; title?: string; slug?: string | { current: string } | null } | null> | null;
  [key: string]: any;
}

// ─── localStorage keys ────────────────────────────────────────────────────────

const RECENT_SEARCHES_KEY = 'recentSearches';
const RECENTLY_VIEWED_KEY = 'recentlyViewedBooks';
const MAX_SEARCHES = 10;
const MAX_VIEWED = 20;

// Decay: a view N days old is worth (1 - N * DECAY_PER_DAY), floored at MIN_WEIGHT.
const DECAY_PER_DAY = 0.05;
const MIN_WEIGHT = 0.2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ─── Null-safe helpers ────────────────────────────────────────────────────────

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function safeLower(value: unknown): string {
  return safeString(value).toLowerCase();
}

// Extract an author name whether it's a string, populated ref, or missing.
function authorName(author: ScoredBook['author'] | RecentlyViewedBook['author']): string {
  if (!author) return '';
  if (typeof author === 'string') return author;
  if (typeof author === 'object' && 'name' in author) return safeString(author.name);
  return '';
}

// ─── Recent Searches ──────────────────────────────────────────────────────────

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): void {
  const trimmed = safeString(term).trim();
  if (!trimmed) return;
  const existing = getRecentSearches().filter(s => s !== trimmed);
  const updated = [trimmed, ...existing].slice(0, MAX_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

export function clearRecentSearches(): void {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

// ─── Recently Viewed Books ────────────────────────────────────────────────────

export function getRecentlyViewedBooks(): RecentlyViewedBook[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((b): b is RecentlyViewedBook => !!b && typeof b === 'object' && typeof b._id === 'string');
  } catch {
    return [];
  }
}

export function addRecentlyViewedBook(book: RecentlyViewedBook): void {
  if (!book || typeof book._id !== 'string') return;
  const stamped: RecentlyViewedBook = {
    _id: book._id,
    title: safeString(book.title),
    author: authorName(book.author) || undefined,
    series: book.series ?? undefined,
    publisher: book.publisher ?? undefined,
    categories: book.categories ?? undefined,
    viewedAt: Date.now(),
  };
  const existing = getRecentlyViewedBooks().filter(b => b._id !== stamped._id);
  const updated = [stamped, ...existing].slice(0, MAX_VIEWED);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function getCategoryIds(book: ScoredBook | RecentlyViewedBook): Set<string> {
  const ids = new Set<string>();
  for (const cat of book.categories ?? []) {
    if (!cat) continue;
    if (cat._id) ids.add(cat._id);
    if (cat.slug) {
      const slug = typeof cat.slug === 'string' ? cat.slug : cat.slug?.current;
      if (slug) ids.add(slug);
    }
  }
  return ids;
}

function tokenize(text?: string | null): Set<string> {
  const s = safeString(text);
  if (!s) return new Set();
  return new Set(
    s.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

// Weight for a viewed book based on age. Uses `now` as reference so all views
// in the same call share a consistent decay basis.
function decayWeight(viewedAt: number | undefined, now: number): number {
  if (!viewedAt) return 1;
  const ageDays = Math.max(0, (now - viewedAt) / MS_PER_DAY);
  return Math.max(MIN_WEIGHT, 1 - ageDays * DECAY_PER_DAY);
}

// ─── Recommendation Engine ────────────────────────────────────────────────────

/**
 * Score a candidate book against viewing history and search history.
 * Higher = more relevant. Returns 0 for books with no signal.
 * Never throws — every input is treated as potentially null/undefined.
 */
export function scoreBook(
  candidate: ScoredBook,
  viewedBooks: RecentlyViewedBook[],
  recentSearches: string[],
  now: number = Date.now()
): number {
  let score = 0;
  const candidateCats = getCategoryIds(candidate);
  const candidateTitleTokens = tokenize(candidate.title);
  const candidateDescTokens = tokenize(candidate.description);
  const candidateAuthor = authorName(candidate.author);

  for (const viewed of viewedBooks) {
    if (!viewed) continue;
    const weight = decayWeight(viewed.viewedAt, now);
    const viewedAuthorName = authorName(viewed.author);

    // Same author (name-based comparison, case-sensitive matches Sanity's dereferenced string)
    if (viewedAuthorName && candidateAuthor && viewedAuthorName === candidateAuthor) {
      score += 4 * weight;
    }
    // Same series
    if (viewed.series && candidate.series && viewed.series === candidate.series) {
      score += 3 * weight;
    }
    // Same publisher
    if (viewed.publisher && candidate.publisher && viewed.publisher === candidate.publisher) {
      score += 2 * weight;
    }
    // Overlapping categories
    const viewedCats = getCategoryIds(viewed);
    for (const catId of viewedCats) {
      if (candidateCats.has(catId)) score += 5 * weight;
    }
    // Title keyword overlap with viewed book's title
    const viewedTitleTokens = tokenize(viewed.title);
    for (const token of viewedTitleTokens) {
      if (candidateTitleTokens.has(token)) score += 2 * weight;
    }
  }

  // Recent searches — secondary signal, no decay (searches are already ordered latest-first)
  for (const term of recentSearches) {
    const termLower = safeLower(term);
    if (!termLower) continue;
    if (safeLower(candidate.title).includes(termLower)) score += 2;
    if (safeLower(candidate.description).includes(termLower)) score += 1;
    if (candidateAuthor && candidateAuthor.toLowerCase().includes(termLower)) score += 1;
    // Description keyword tokens
    if (candidateDescTokens.has(termLower)) score += 1;
  }

  return score;
}

// ─── Collection Recommendation ───────────────────────────────────────────────

export interface ScoredCollection {
  collection: any;
  score: number;
  matchCount: number;
}

/**
 * Score collections based on how many of their books are recommended.
 * Collections with zero matching books are excluded.
 * Returns collections sorted by score descending.
 */
export function getRecommendedCollections(
  collections: any[],
  allBooks: ScoredBook[],
  viewedBooks: RecentlyViewedBook[],
  recentSearches: string[]
): ScoredCollection[] {
  if (!Array.isArray(collections) || collections.length === 0) return [];
  if (viewedBooks.length === 0 && recentSearches.length === 0) return [];

  const now = Date.now();

  const scored: ScoredCollection[] = [];

  for (const col of collections) {
    if (!col || !Array.isArray(col.books)) continue;

    let totalScore = 0;
    let matchCount = 0;

    for (const book of col.books) {
      if (!book || typeof book._id !== 'string') continue;
      const bookScore = scoreBook(book, viewedBooks, recentSearches, now);
      if (bookScore > 0) {
        totalScore += bookScore;
        matchCount++;
      }
    }

    if (matchCount > 0) {
      scored.push({ collection: col, score: totalScore, matchCount });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Returns books sorted by relevance score.
 * Books already in viewedBooks are pushed to the bottom to encourage discovery.
 * Books with score 0 are excluded entirely (no signal for them).
 */
export function getRecommendations(
  allBooks: ScoredBook[],
  viewedBooks: RecentlyViewedBook[],
  recentSearches: string[]
): ScoredBook[] {
  if (!Array.isArray(allBooks) || allBooks.length === 0) return [];
  if (viewedBooks.length === 0 && recentSearches.length === 0) return [];

  const now = Date.now();
  const viewedIds = new Set(viewedBooks.map(b => b?._id).filter(Boolean));

  const scored = allBooks
    .filter((b): b is ScoredBook => !!b && typeof b._id === 'string')
    .map(book => ({ book, score: scoreBook(book, viewedBooks, recentSearches, now) }))
    .filter(({ score }) => score > 0);

  // Sort: unviewed first (discovery), then by score descending
  scored.sort((a, b) => {
    const aViewed = viewedIds.has(a.book._id) ? 1 : 0;
    const bViewed = viewedIds.has(b.book._id) ? 1 : 0;
    if (aViewed !== bViewed) return aViewed - bViewed;
    return b.score - a.score;
  });

  return scored.map(({ book }) => book);
}
