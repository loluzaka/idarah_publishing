import type { MetadataRoute } from 'next';
import { SITE } from './lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/admin/',
          '/profile',
          '/checkout',
          '/login',
          '/cart',
          '/studio',   // Sanity Studio (legacy path)
          '/stud10',   // Sanity Studio (actual route: app/stud10)
        ],
      },
    ],
    sitemap: `${SITE.url.replace(/\/$/, '')}/sitemap.xml`,
  };
}
