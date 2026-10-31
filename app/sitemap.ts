import type { MetadataRoute } from 'next';
import { client } from './sanityClient';
import { SITE } from './lib/seo';

export const revalidate = 3600; // regenerated at most hourly; Netlify serves the cached XML

// Fixed dates so lastModified doesn't churn every rebuild
const LAUNCH = new Date('2026-01-01');

interface Doc {
  slug?: string;
  _id?: string;
  _updatedAt?: string;
}

/** Fetch one document list; a Sanity hiccup drops that section, not the whole sitemap. */
async function fetchDocs(query: string, label: string): Promise<Doc[]> {
  try {
    return (await client.fetch<Doc[]>(query, {}, { next: { revalidate } })) ?? [];
  } catch (err) {
    console.warn(`Sitemap: failed to load ${label}`, err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, '');
  const now = new Date();

  const [books, collections, articles] = await Promise.all([
    fetchDocs(`*[_type == "book"]{ _id, _updatedAt }`, 'books'),
    fetchDocs(`*[_type == "collection" && enabled == true && defined(slug.current)]{ "slug": slug.current, _updatedAt }`, 'collections'),
    fetchDocs(`*[_type == "article" && defined(slug.current) && publishedAt <= now()]{ "slug": slug.current, _updatedAt }`, 'articles'),
  ]);

  // Static routes (public, indexable pages only — no cart/checkout/login/profile/admin)
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`,                lastModified: now,    changeFrequency: 'daily',   priority: 1.0 },
    { url: `${base}/books`,           lastModified: now,    changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/articles`,        lastModified: articles.length ? new Date(articles[0]._updatedAt ?? now) : LAUNCH, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/authors`,         lastModified: LAUNCH, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/how-to-order`,    lastModified: LAUNCH, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${base}/publish-with-us`, lastModified: LAUNCH, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${base}/about`,           lastModified: LAUNCH, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${base}/contact`,         lastModified: LAUNCH, changeFrequency: 'yearly',  priority: 0.4 },
  ];

  for (const c of collections) {
    routes.push({ url: `${base}/collections/${c.slug}`, lastModified: c._updatedAt ? new Date(c._updatedAt) : now, changeFrequency: 'weekly', priority: 0.8 });
  }
  // Book pages are the content that matters most for search.
  for (const b of books) {
    if (b._id) routes.push({ url: `${base}/books/${b._id}`, lastModified: b._updatedAt ? new Date(b._updatedAt) : now, changeFrequency: 'weekly', priority: 0.8 });
  }
  for (const a of articles) {
    routes.push({ url: `${base}/articles/${a.slug}`, lastModified: a._updatedAt ? new Date(a._updatedAt) : now, changeFrequency: 'monthly', priority: 0.7 });
  }

  return routes;
}
