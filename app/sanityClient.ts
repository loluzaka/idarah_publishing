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