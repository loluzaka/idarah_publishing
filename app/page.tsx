import type { Metadata } from 'next';
import { client } from './sanityClient';
import { buildMetadata } from './lib/seo';
import HomeClient, { type Book, type Collection } from './HomeClient';

// Static + ISR: the home page is rendered at build time and re-rendered in the
// background at most once a minute, so Netlify serves it straight from the CDN
// (no function invocation per visit). Sanity edits appear within ~60s.
export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  path: '/',
  keywords: ['Urdu bookstore online India', 'buy classical Urdu literature books', 'Islamic history books online'],
});

const FEATURED_COLLECTIONS = `
  *[_type == "collection" && enabled == true && featured == true] | order(priority asc) {
    _id, title, slug, description, bannerImage, thumbnailImage, displayStyle, featured, priority,
    "books": books[]->{
      _id, title,
      "authors": authors[]->name,
      "authorShorts": authors[]->shortName,
      price, originalPrice, stock, coverImage
    }
  }
`;

const ALL_BOOKS = `*[_type == "book"] {
  _id,
  title,
  "authors": authors[]->name,
  "authorShorts": authors[]->shortName,
  price,
  originalPrice,
  series,
  publisher,
  description,
  coverImage,
  "categories": categories[]->{_id, title, "slug": slug.current},
  homepageSlides
}`;

export default async function HomePage() {
  // Both queries run in parallel; a Sanity outage renders an empty (but valid)
  // page instead of failing the build / the revalidation.
  const [collections, books] = await Promise.all([
    client.fetch<Collection[]>(FEATURED_COLLECTIONS, {}, { next: { revalidate } }).catch((err) => {
      console.error('Home collections query failed:', err);
      return [] as Collection[];
    }),
    client.fetch<Book[]>(ALL_BOOKS, {}, { next: { revalidate } }).catch((err) => {
      console.error('Home books query failed:', err);
      return [] as Book[];
    }),
  ]);

  return <HomeClient initialBooks={books ?? []} initialCollections={collections ?? []} />;
}
