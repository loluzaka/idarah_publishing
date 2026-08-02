// SEO utilities — metadata builders + JSON-LD structured data.

import type { Metadata } from 'next';

export const SITE = {
  name: 'Idarah-i Adabiyat-i Dilli',
  tagline: 'Associated with Jayyad Press · Classical Publications & Historical Literature',
  description:
    'Idarah-i Adabiyat-i Dilli — publishing house associated with Jayyad Press. Curated catalog of Urdu literature, historical translations, and academic reference works from Delhi since 1970.',
  // Set NEXT_PUBLIC_SITE_URL in .env.local (e.g. https://idarah-adabiyat.com)
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://idarah-adabiyat.example.com',
  ogImage: '/og-default.jpg',
  twitterHandle: '', // e.g. '@idarahadab'
  publisher: 'Idarah-i Adabiyat-i Dilli',
  locale: 'en_IN',
} as const;

interface PageMetaInput {
  title?: string;
  description?: string;
  path?: string;         // "/books" or "/collections/urdu-literature" — leading slash
  image?: string;        // absolute or relative
  noIndex?: boolean;
  type?: 'website' | 'article' | 'book';
}

/** Build a full Next.js Metadata object with sensible defaults. */
export function buildMetadata(input: PageMetaInput = {}): Metadata {
  const title = input.title ? `${input.title} · ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`;
  const description = input.description ?? SITE.description;
  const url = `${SITE.url}${input.path ?? '/'}`;
  const image = input.image
    ? (input.image.startsWith('http') ? input.image : `${SITE.url}${input.image}`)
    : `${SITE.url}${SITE.ogImage}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      locale: SITE.locale,
      type: input.type ?? 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      ...(SITE.twitterHandle ? { site: SITE.twitterHandle, creator: SITE.twitterHandle } : {}),
    },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  };
}

// ─── JSON-LD builders ─────────────────────────────────────────────────────────

/** Site-wide Organization schema. Include once in root layout. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/logo.svg`,
    description: SITE.description,
    sameAs: [] as string[],  // add social URLs when you have them
  };
}

interface BookLD {
  _id: string;
  title: string;
  author?: string | null;
  isbn?: string | null;
  description?: string | null;
  publisher?: string | null;
  language?: string | null;
  price: number;
  originalPrice?: number | null;
  stock?: number | null;
  coverImageUrl?: string | null;
  url?: string;
}

/** schema.org/Book + Offer, ideal for a book detail page. */
export function bookJsonLd(book: BookLD) {
  const availability =
    book.stock == null ? 'InStock' :
    book.stock <= 0 ? 'OutOfStock' :
    book.stock <= 5 ? 'LimitedAvailability' : 'InStock';

  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    '@id': book.url ?? `${SITE.url}/books#${book._id}`,
    name: book.title,
    ...(book.author ? { author: { '@type': 'Person', name: book.author } } : {}),
    ...(book.isbn ? { isbn: book.isbn } : {}),
    ...(book.description ? { description: book.description.slice(0, 500) } : {}),
    ...(book.publisher ? { publisher: { '@type': 'Organization', name: book.publisher } } : { publisher: { '@type': 'Organization', name: SITE.publisher } }),
    ...(book.language ? { inLanguage: book.language } : {}),
    ...(book.coverImageUrl ? { image: book.coverImageUrl } : {}),
    offers: {
      '@type': 'Offer',
      price: book.price,
      priceCurrency: 'INR',
      ...(book.originalPrice && book.originalPrice > book.price ? { priceSpecification: { '@type': 'PriceSpecification', price: book.price, priceCurrency: 'INR' } } : {}),
      availability: `https://schema.org/${availability}`,
      seller: { '@type': 'Organization', name: SITE.publisher },
      url: book.url ?? `${SITE.url}/books`,
    },
  };
}

/** Small helper to render a JSON-LD <script> tag safely from React. */
export function jsonLdString(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
