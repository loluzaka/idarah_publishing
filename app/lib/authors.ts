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

/** Render one, two, or many contributor names in a consistent editorial style. */
export function formatAuthors(authors: unknown, fallback = 'Unknown Author'): string {
  const names = normalizeAuthors(authors);
  if (names.length === 0) return fallback;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** True when two books share at least one contributor, ignoring name case. */
export function sharesAuthor(first: unknown, second: unknown): boolean {
  const firstNames = new Set(normalizeAuthors(first).map(name => name.toLocaleLowerCase()));
  return normalizeAuthors(second).some(name => firstNames.has(name.toLocaleLowerCase()));
}
