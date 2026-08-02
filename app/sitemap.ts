import type { MetadataRoute } from 'next';
import { client } from './sanityClient';
import { SITE } from './lib/seo';

export const revalidate = 3600; // Rebuild sitemap hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, '');
  const now = new Date();

  // Static routes
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`,                lastModified: now, changeFrequency: 'daily',  priority: 1.0 },
    { url: `${base}/books`,           lastModified: now, changeFrequency: 'daily',  priority: 0.9 },
    { url: `${base}/how-to-order`,    lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/about`,           lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/contact`,         lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
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

  return routes;
}
