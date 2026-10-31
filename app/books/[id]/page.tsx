import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { client, sanityImageUrl } from '@/app/sanityClient';
import { buildMetadata, SITE } from '@/app/lib/seo';
import { SchemaOrg } from '@/components/seo/SchemaOrg';
import BookDetailClient, { type BookDetail } from './BookDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

// Server-rendered + ISR: metadata, JSON-LD and the book's text are in the HTML
// crawlers fetch, and Netlify serves it from the CDN between revalidations.
export const revalidate = 300;

// Pre-render every book at build time (ISR keeps them fresh); books added later
// render on their first request.
export async function generateStaticParams() {
  try {
    const ids = await client.fetch<string[]>(`*[_type == "book"]._id`);
    return (ids ?? []).map((id) => ({ id }));
  } catch {
    return [];
  }
}

const BOOK_QUERY = `*[_type == "book" && _id == $id][0]{
  _id, title, series, price, originalPrice, description, pages, binding,
  publisher, year, language, stock, coverPlaceholder, coverImage,
  "authors": authors[]->name,
  "category": category->{title},
  "categories": categories[]->{title, "slug": slug.current}
}`;

// Journal articles that feature this book — an internal-link pipeline in the
// other direction (book page → article).
const BOOK_ARTICLES_QUERY = `*[_type == "article" && defined(slug.current) && publishedAt <= now() && references($id)]
  | order(publishedAt desc)[0...4]{ title, "slug": slug.current, excerpt }`;

async function getBook(id: string): Promise<BookDetail | null> {
  try {
    return await client.fetch<BookDetail | null>(BOOK_QUERY, { id }, { next: { revalidate } });
  } catch (err) {
    console.error('Book query failed:', err);
    return null;
  }
}

const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return buildMetadata({ title: 'Book Not Found', noIndex: true });

  const authors = (book.authors ?? []).filter(Boolean);
  const byline = authors.length ? ` by ${authors.join(', ')}` : '';
  const cats = (book.categories ?? []).map((c) => c.title).filter(Boolean);
  const description = book.description?.trim()
    ? trim(book.description.replace(/\s+/g, ' ').trim(), 158)
    : `Buy ${book.title}${byline} online from Idara Adabiyat Delhi (Idarah Books) for ₹${book.price}. Shipped across India and worldwide.`;

  return buildMetadata({
    title: `${book.title}${byline}`,
    description,
    path: `/books/${book._id}`,
    image: sanityImageUrl(book.coverImage, 1200) ?? undefined,
    keywords: [
      book.title,
      `buy ${book.title} online`,
      ...authors,
      ...authors.map((a) => `${a} books`),
      ...cats,
      ...(book.language ? [`${book.language} books online`] : []),
    ],
  });
}

export default async function BookPage({ params }: Props) {
  const { id } = await params;
  const [book, articles] = await Promise.all([
    getBook(id),
    client
      .fetch<{ title: string; slug: string; excerpt?: string }[]>(BOOK_ARTICLES_QUERY, { id }, { next: { revalidate } })
      .catch(() => []),
  ]);
  if (!book) notFound(); // real HTTP 404 (the old client page returned 200 for missing books)

  return (
    <>
      <SchemaOrg
        type="book"
        book={{
          ...book,
          coverImageUrl: sanityImageUrl(book.coverImage, 800),
          url: `${SITE.url}/books/${book._id}`,
        }}
      />
      <SchemaOrg
        type="breadcrumb"
        items={[
          { name: 'Home', path: '/' },
          { name: 'Catalogue', path: '/books' },
          { name: book.title, path: `/books/${book._id}` },
        ]}
      />

      <BookDetailClient book={book} />

      {articles.length > 0 && (
        <aside className="max-w-5xl mx-auto px-6 pb-14 font-sans" aria-labelledby="read-more-heading">
          <h2 id="read-more-heading" className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/50 mb-3">
            Read more about this book
          </h2>
          <ul className="space-y-2">
            {articles.map((a) => (
              <li key={a.slug}>
                <Link href={`/articles/${a.slug}`} className="text-sm font-semibold text-[#7D5A34] underline-offset-4 hover:underline">
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </>
  );
}
