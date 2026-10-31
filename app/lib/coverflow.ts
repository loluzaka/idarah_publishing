// Maps Sanity book documents into the slides the Coverflow carousel renders.

import { sanityImageUrl } from '@/app/sanityClient';
import { customerPrice } from '@/app/lib/pricing';
import type { SanityImage, CategoryRef } from '@/app/lib/sanity-types';
import type { CoverflowSlide } from '@/components/ui/coverflow-carousel';

/** The fields we need from a `*[_type == "book"]` GROQ result. */
export interface CoverflowSourceBook {
  _id: string;
  title: string;
  authors?: string[] | null;
  language?: string;
  year?: string;
  price: number;
  originalPrice?: number;
  coverImage?: SanityImage;
  categories?: CategoryRef[];
}

const slugOf = (c: CategoryRef): string => (typeof c?.slug === 'string' ? c.slug : c?.slug?.current ?? '');

/** Featured titles first: new arrivals, then bestsellers, then the rest. */
function rank(b: CoverflowSourceBook): number {
  const slugs = (b.categories ?? []).map(slugOf);
  return slugs.includes('new-arrivals') ? 0 : slugs.includes('bestsellers') ? 1 : 2;
}

/**
 * Returns the slides plus a parallel array of book ids, so a click on slide `i`
 * can open `ids[i]`. Books without a cover are skipped (a coverflow of blanks
 * is worse than a shorter one). Covers are cropped to 5:7 server-side by Sanity
 * and served as WebP/AVIF, so the browser downloads only what it paints.
 */
export function toCoverflowSlides(
  books: CoverflowSourceBook[],
  discountRate: number | null | undefined,
  limit = 30
): { slides: CoverflowSlide[]; ids: string[] } {
  const picked = books
    .map((b, i) => ({ b, i, src: sanityImageUrl(b.coverImage, 520, 728) }))
    .filter((x): x is { b: CoverflowSourceBook; i: number; src: string } => !!x.src)
    .sort((x, y) => rank(x.b) - rank(y.b) || x.i - y.i) // stable within a rank
    .slice(0, limit);

  const slides = picked.map(({ b, src }): CoverflowSlide => {
    const priced = customerPrice(b.price, b.originalPrice, discountRate);
    const meta: { label: string; value: string }[] = [];
    if (b.year) meta.push({ label: 'Year', value: b.year });
    if (b.language) meta.push({ label: 'Language', value: b.language });
    meta.push({ label: 'Price', value: `₹${priced.finalPrice}` });
    return {
      src,
      alt: b.title,
      title: b.title,
      subtitle: (b.authors ?? []).filter(Boolean).join(', ') || undefined,
      meta,
    };
  });

  return { slides, ids: picked.map(({ b }) => b._id) };
}
