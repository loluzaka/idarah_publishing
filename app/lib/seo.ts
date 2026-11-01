// SEO utilities — keyword matrix, metadata builders, JSON-LD builders.
//
// Brand note: the site's own spelling is "Idarah-i Adabiyat-i Dilli", but people
// search with many transliterations ("Idara Adabiyat Delhi", "Idarah-e-Adabiyat-e-Delhi",
// Urdu/Hindi script…). BRAND_VARIANTS feeds <meta keywords>, the Organization
// `alternateName` and the visible "also known as" line, so every variant maps
// to this one entity.

import type { Metadata } from 'next';

// ─── Keyword matrix ───────────────────────────────────────────────────────────

/** Primary brand terms. */
export const BRAND_PRIMARY = [
  'Idarah-e-Adabiyat-e-Delhi',
  'Idara Adabiyat Delhi',
  'Idara e Adabiyat',
  'Idarah Books',
] as const;

/** Phonetic / colloquial / typo-tolerant spellings. */
export const BRAND_VARIANTS = [
  'Idara Adabiyat',
  'Idara Adabiyat E Delhi',
  'Idarah Adabiyat',
  'Idara-e-Adabiyat',
  'Idara-e-Adabiyat-e-Delhi',
  'Idara Adabiyath',
  'Idarah-i Adabiyat-i Dilli',
  'Idarah-i Adabiyat-i Delli',
  'Idara Adabiyat Dilli',
  'Idarah-e-Adabiyat-e-Dilli',
] as const;

/** Urdu / Hindi script search terms. */
export const BRAND_VERNACULAR = [
  'ادارہ ادبیات دہلی',
  'ادارہ ادبیات',
  'इदारे अदबियात दिल्ली',
  'इदारा अदबियात',
] as const;

/** Category / intent keywords. */
export const INTENT_KEYWORDS = [
  'Urdu bookstore online India',
  'buy classical Urdu literature books',
  'Persian manuscripts India',
  'Ghalib rare books',
  'Islamic history books online',
  'Urdu academic publications Delhi',
] as const;

/** Merge keyword lists, case-insensitively de-duplicated, order preserved. */
export function mergeKeywords(...lists: (readonly string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of lists.flatMap((l) => l ?? [])) {
    const key = k.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(k.trim());
    }
  }
  return out;
}

/** Baseline keywords every page inherits (page-specific ones go first). */
export const DEFAULT_KEYWORDS = mergeKeywords(BRAND_PRIMARY, BRAND_VARIANTS, BRAND_VERNACULAR, INTENT_KEYWORDS);

// ─── Site constants ───────────────────────────────────────────────────────────

export const SITE = {
  name: 'Idarah-i Adabiyat-i Dilli',
  alternateName: 'Idarah Books',
  tagline: 'Classical Publications & Historical Literature',
  /** Appended to every page title: "[Book Title / Category] | Idara Adabiyat Delhi (Idarah Books)". */
  titleSuffix: 'Idara Adabiyat Delhi (Idarah Books)',
  defaultTitle: 'Idarah-e-Adabiyat-e-Delhi (Idara Adabiyat Delhi) — Urdu, Arabic & Persian Books Online',
  description:
    'Idarah-e-Adabiyat-e-Delhi (Idara Adabiyat Delhi) — Delhi publisher and online bookstore for classical Urdu literature, Persian and Arabic works, Islamic history and South Asian heritage. Buy rare and academic books online, shipped across India and worldwide.',
  // Set NEXT_PUBLIC_SITE_URL in .env.local (e.g. https://idarahbooks.in)
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://idarahbooks.in',
  ogImage: '/og-default.jpg',
  twitterHandle: '', // e.g. '@idarahadab'
  publisher: 'Idarah-i Adabiyat-i Dilli',
  locale: 'en_IN',
} as const;

const abs = (path: string) => `${SITE.url.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
const absImage = (img?: string) => (img ? (img.startsWith('http') ? img : abs(img)) : abs(SITE.ogImage));

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface PageMetaInput {
  /** Page-specific part only; the layout's template appends "| Idara Adabiyat Delhi (Idarah Books)". */
  title?: string;
  description?: string;
  path?: string;         // "/books" or "/collections/urdu-literature" — leading slash
  image?: string;        // absolute or relative
  noIndex?: boolean;
  type?: 'website' | 'article' | 'book';
  /** Page-specific keywords; the site-wide brand/intent keywords are appended. */
  keywords?: readonly string[];
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
}

/** Build a full Next.js Metadata object with sensible defaults. */
export function buildMetadata(input: PageMetaInput = {}): Metadata {
  // Open Graph / Twitter don't go through the layout's title template, so spell it out.
  const socialTitle = input.title ? `${input.title} | ${SITE.titleSuffix}` : SITE.defaultTitle;
  const description = input.description ?? SITE.description;
  const url = abs(input.path ?? '/');
  const image = absImage(input.image);

  return {
    // Child pages return the bare title so app/layout.tsx's `title.template` applies;
    // the home page (no title) gets the explicit default.
    title: input.title ?? { absolute: SITE.defaultTitle },
    description,
    keywords: mergeKeywords(input.keywords, DEFAULT_KEYWORDS),
    icons: {
      icon: [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }, '/favicon.ico'],
      apple: '/apple-icon.png',
    },
    alternates: { canonical: url },
    openGraph: {
      title: socialTitle,
      description,
      url,
      siteName: SITE.name,
      images: [{ url: image, width: 1200, height: 630, alt: socialTitle }],
      locale: SITE.locale,
      type: input.type === 'article' ? 'article' : 'website',
      ...(input.type === 'article'
        ? { publishedTime: input.publishedTime, modifiedTime: input.modifiedTime, authors: input.authors }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
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

const ORG_ID = `${SITE.url}/#organization`;
const WEBSITE_ID = `${SITE.url}/#website`;

/** Site-wide Organization schema. Include once in the root layout. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.name,
    // Every spelling people actually type, so search engines tie them to this entity.
    alternateName: mergeKeywords([SITE.alternateName], BRAND_PRIMARY, BRAND_VARIANTS, BRAND_VERNACULAR),
    url: SITE.url,
    logo: { '@type': 'ImageObject', url: `${SITE.url}/logo.svg` },
    image: abs(SITE.ogImage),
    description: SITE.description,
    areaServed: ['IN', 'Worldwide'],
    knowsAbout: [
      'Urdu literature', 'Persian literature', 'Arabic literature', 'Islamic history',
      'South Asian history', 'Urdu poetry', 'Ghalib', 'Rare books and manuscripts',
    ],
    sameAs: [] as string[],  // add social URLs when you have them
  };
}

/** WebSite schema with a sitelinks search box (the catalogue reads ?q=). */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE.url,
    name: SITE.name,
    alternateName: mergeKeywords([SITE.alternateName], BRAND_PRIMARY),
    inLanguage: ['en', 'ur'],
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE.url}/books?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  /** Path ("/books/abc") or absolute URL. */
  path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.path.startsWith('http') ? it.path : abs(it.path),
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** FAQPage — answers should match the visible on-page text. */
export function faqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items
      .filter((f) => f.question?.trim() && f.answer?.trim())
      .map((f) => ({
        '@type': 'Question',
        name: f.question.trim(),
        acceptedAnswer: { '@type': 'Answer', text: f.answer.trim() },
      })),
  };
}

interface ArticleLD {
  title: string;
  description?: string;
  path: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  keywords?: string[];
}

export function articleJsonLd(a: ArticleLD) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${abs(a.path)}#article`,
    mainEntityOfPage: abs(a.path),
    headline: a.title.slice(0, 110),
    ...(a.description ? { description: a.description } : {}),
    image: [absImage(a.image)],
    datePublished: a.datePublished,
    dateModified: a.dateModified ?? a.datePublished,
    author: a.authorName ? { '@type': 'Person', name: a.authorName } : { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    ...(a.keywords?.length ? { keywords: a.keywords.join(', ') } : {}),
    inLanguage: 'en',
  };
}

export interface BookLD {
  _id: string;
  title: string;
  authors?: string[] | null;
  description?: string | null;
  publisher?: string | null;
  language?: string | null;
  year?: string | null;
  pages?: number | null;
  binding?: string | null;
  price: number;
  originalPrice?: number | null;
  stock?: number | null;
  coverImageUrl?: string | null;
  url?: string;
  /** Volumes of a multi-volume set (sold only as a whole). */
  volumes?: { volumeNumber?: number | null; title?: string | null; pages?: number | null }[] | null;
}

/** schema.org/Book + Offer, ideal for a book detail page. */
export function bookJsonLd(book: BookLD) {
  const availability =
    book.stock == null ? 'InStock' :
    book.stock <= 0 ? 'OutOfStock' :
    book.stock <= 5 ? 'LimitedAvailability' : 'InStock';
  const authors = (book.authors ?? []).map(name => name.trim()).filter(Boolean);
  const binding = book.binding?.toLowerCase() ?? '';
  const bookFormat = /hard|library|cloth/.test(binding)
    ? 'https://schema.org/Hardcover'
    : /paper|soft/.test(binding) ? 'https://schema.org/Paperback' : undefined;
  const url = book.url ?? `${SITE.url}/books/${book._id}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    '@id': url,
    name: book.title,
    url,
    ...(authors.length ? { author: authors.map(name => ({ '@type': 'Person', name })) } : {}),
    ...(book.description ? { description: book.description.slice(0, 500) } : {}),
    publisher: { '@type': 'Organization', name: book.publisher || SITE.publisher },
    ...(book.language ? { inLanguage: book.language } : {}),
    ...(book.year ? { datePublished: book.year } : {}),
    ...(book.pages ? { numberOfPages: book.pages } : {}),
    ...(bookFormat ? { bookFormat } : {}),
    ...(book.coverImageUrl ? { image: book.coverImageUrl } : {}),
    ...(book.volumes?.length
      ? {
          hasPart: [...book.volumes]
            .sort((a, b) => (a.volumeNumber ?? 0) - (b.volumeNumber ?? 0))
            .map((v, i) => ({
              '@type': 'Book',
              name: v.title?.trim() || `${book.title}, Volume ${v.volumeNumber ?? i + 1}`,
              position: v.volumeNumber ?? i + 1,
              ...(v.pages ? { numberOfPages: v.pages } : {}),
            })),
        }
      : {}),
    offers: {
      '@type': 'Offer',
      price: book.price,
      priceCurrency: 'INR',
      ...(book.originalPrice && book.originalPrice > book.price ? { priceSpecification: { '@type': 'PriceSpecification', price: book.price, priceCurrency: 'INR' } } : {}),
      availability: `https://schema.org/${availability}`,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': ORG_ID },
      url,
    },
  };
}

/** Small helper to render a JSON-LD <script> tag safely from React. */
export function jsonLdString(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
