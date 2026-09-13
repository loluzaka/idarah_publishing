import type { MetadataRoute } from 'next';
import { client } from './sanityClient';
import { SITE } from './lib/seo';

export const revalidate = 3600; // Rebuild sitemap hourly

// Fixed dates so lastModified doesn't churn every rebuild
const LAUNCH = new Date('2026-01-01');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, '');
  const now = new Date();

  // Static routes (public, indexable pages only — no cart/checkout/login/profile/admin)
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`,                lastModified: now,    changeFrequency: 'daily',  priority: 1.0 },
    { url: `${base}/books`,           lastModified: now,    changeFrequency: 'daily',  priority: 0.9 },
    { url: `${base}/authors`,         lastModified: LAUNCH, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/how-to-order`,    lastModified: LAUNCH, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/publish-with-us`, lastModified: LAUNCH, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/about`,           lastModified: LAUNCH, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/contact`,         lastModified: LAUNCH, changeFrequency: 'yearly', priority: 0.4 },
  ];

  // Dynamic: collections
  try {
    const collections: { slug: { current: string }; _updatedAt?: string }[] = await client.fetch(
      `*[_type == "collection" && enabled == true]{ slug, _updatedAt }`
    );
    for (const c of collections ?? []) {
      if (c.slug?.current) {
        routes.push({
          url: `${base}/collections/${c.slug.current}`,
          lastModified: c._updatedAt ? new Date(c._updatedAt) : now,
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    }
  } catch (err) {
    console.warn('Sitemap: failed to load collections', err);
  }

  // Dynamic: books — the content pages that matter most for SEO
  try {
    const books: { _id: string; _updatedAt?: string }[] = await client.fetch(
      `*[_type == "book"]{ _id, _updatedAt }`
    );
    for (const b of books ?? []) {
      if (b._id) {
        routes.push({
          url: `${base}/books/${b._id}`,
          lastModified: b._updatedAt ? new Date(b._updatedAt) : now,
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    }
  } catch (err) {
    console.warn('Sitemap: failed to load books', err);
  }

  return routes;
}
