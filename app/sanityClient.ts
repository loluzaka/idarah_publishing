import { createClient } from 'next-sanity';
import { createImageUrlBuilder, type SanityImageSource } from '@sanity/image-url';
import type { SanityImage } from '@/app/lib/sanity-types';

export const client = createClient({
  projectId: 'lvzmkv9e', // Make sure your real 8-character ID string is here!
  dataset: 'production',
  apiVersion: '2024-03-01',
  useCdn: false,
});

// Build using the explicit named export tool
const builder = createImageUrlBuilder(client);

export function urlFor(source: SanityImage | SanityImageSource) {
  return builder.image(source as SanityImageSource);
}
/**
 * Optimised Sanity CDN URL: exact display width (and optional crop height),
 * WebP/AVIF negotiated by the browser (`auto=format`), sane default quality.
 * Returns null for a missing/malformed image so callers can show a placeholder.
 *
 *   sanityImageUrl(book.coverImage, 400)        // ...?w=400&auto=format&q=75
 *   sanityImageUrl(book.coverImage, 400, 560)   // cropped 5:7
 */
export function sanityImageUrl(
  source: SanityImage | SanityImageSource | null | undefined,
  width: number,
  height?: number,
  quality = 75
): string | null {
  if (!source) return null;
  try {
    let b = urlFor(source).width(width).auto('format').quality(quality);
    if (height) b = b.height(height).fit('crop');
    return b.url();
  } catch {
    return null;
  }
}
