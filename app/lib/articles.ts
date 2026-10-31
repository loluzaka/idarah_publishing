// Sanity queries + types for the /articles journal.

import { client } from '@/app/sanityClient';
import type { SanityImage } from '@/app/lib/sanity-types';

export const ARTICLES_REVALIDATE = 300;

export interface ArticleListItem {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  publishedAt: string;
  mainImage?: (SanityImage & { alt?: string }) | null;
  authorName?: string;
}

export interface RelatedBook {
  _id: string;
  title: string;
  authors?: string[] | null;
  price: number;
  originalPrice?: number;
  language?: string;
  year?: string;
  coverImage?: SanityImage;
}

export interface Article extends ArticleListItem {
  _updatedAt: string;
  body?: unknown[];
  relatedBooks?: RelatedBook[] | null;
  faqItems?: { _key?: string; question: string; answer: string }[] | null;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[] | null;
}

// Only published (date reached) articles with a slug are ever public.
const PUBLISHED = `_type == "article" && defined(slug.current) && publishedAt <= now()`;

const LIST_QUERY = `*[${PUBLISHED}] | order(publishedAt desc){
  _id, title, "slug": slug.current, excerpt, publishedAt, mainImage, authorName
}`;

const ONE_QUERY = `*[${PUBLISHED} && slug.current == $slug][0]{
  _id, _updatedAt, title, "slug": slug.current, excerpt, publishedAt, mainImage, authorName,
  body[]{
    ...,
    markDefs[]{ ..., _type == "bookLink" => { "bookId": book->_id } }
  },
  "relatedBooks": relatedBooks[]->{ _id, title, "authors": authors[]->name, price, originalPrice, language, year, coverImage },
  faqItems, metaTitle, metaDescription, metaKeywords
}`;

const next = { next: { revalidate: ARTICLES_REVALIDATE } };

export async function getArticles(): Promise<ArticleListItem[]> {
  try {
    return (await client.fetch<ArticleListItem[]>(LIST_QUERY, {}, next)) ?? [];
  } catch (err) {
    console.error('Articles list query failed:', err);
    return [];
  }
}

export async function getArticle(slug: string): Promise<Article | null> {
  try {
    return (await client.fetch<Article | null>(ONE_QUERY, { slug }, next)) ?? null;
  } catch (err) {
    console.error('Article query failed:', err);
    return null;
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
}
