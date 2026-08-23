/**
 * Shared author-name utilities.
 *
 * `authors` is the canonical storefront shape: an ordered array of author names.
 * `legacyAuthor` exists only while browser carts, order snapshots, and recently
 * viewed entries created before the multi-author migration are still present.
 */
export type AuthorValue = string | { name?: string | null } | null | undefined;

function nameFromValue(value: AuthorValue): string | null {
  const name = typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? value.name
      : null;

  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed || null;
}

/** Return clean, de-duplicated names while preserving their editorial order. */
export function normalizeAuthors(authors: unknown, legacyAuthor?: unknown): string[] {
  const source = Array.isArray(authors)
    ? authors
    : authors == null
      ? legacyAuthor == null ? [] : [legacyAuthor]
      : [authors];

  const seen = new Set<string>();
  const names: string[] = [];

  for (const value of source) {
    const name = nameFromValue(value as AuthorValue);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names;
}

/** Inline, comma-separated contributor list (admin orders, invoice, tooltips). */
export function formatAuthors(authors: unknown, fallback = 'Unknown Author'): string {
  const names = normalizeAuthors(authors);
  return names.length ? names.join(', ') : fallback;
}

/** Contributor names stacked one per line — pair with `whitespace-pre-line` on the element. */
export function stackedAuthors(authors: unknown, fallback = ''): string {
  const names = normalizeAuthors(authors);
  return names.length ? names.join('\n') : fallback;
}

function heuristicShortName(full: string): string {
  const words = full.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return full;
  return `${words[0]} ${words[words.length - 1]}`;
}

/**
 * Short, stacked byline for small cards. Prefers the editor-set `shortName`
 * (aligned by author order) and falls back to `Firstname Surname` so cards
 * still look tidy before any short names are filled in.
 */
export function stackedShortAuthors(fullNames: unknown, shortNames?: unknown, fallback = ''): string {
  const full = normalizeAuthors(fullNames);
  if (!full.length) return fallback;
  const shorts = (Array.isArray(shortNames) ? shortNames : [])
    .map(value => (typeof value === 'string' ? value.trim() : null));

  const seen = new Set<string>();
  const lines: string[] = [];
  full.forEach((name, index) => {
    const short = (shorts[index] || heuristicShortName(name)).trim();
    if (!short) return;
    const key = short.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(short);
  });
  return lines.length ? lines.join('\n') : fallback;
}

/** True when two books share at least one contributor, ignoring name case. */
export function sharesAuthor(first: unknown, second: unknown): boolean {
  const firstNames = new Set(normalizeAuthors(first).map(name => name.toLocaleLowerCase()));
  return normalizeAuthors(second).some(name => firstNames.has(name.toLocaleLowerCase()));
}
