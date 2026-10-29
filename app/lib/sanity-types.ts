// Shared shapes for data coming back from Sanity.

/** A Sanity image field. Only `asset` is read directly; the rest feeds urlFor(). */
export interface SanityImage {
  asset?: { _ref?: string; _id?: string } | null;
  [key: string]: unknown;
}

/** A category reference as projected by our GROQ queries. */
export interface CategoryRef {
  _id?: string;
  title?: string;
  slug?: string | { current?: string } | null;
}
