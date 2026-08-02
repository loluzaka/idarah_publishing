import { createClient } from 'next-sanity';
import { createImageUrlBuilder } from '@sanity/image-url';

export const client = createClient({
  projectId: 'lvzmkv9e', // Make sure your real 8-character ID string is here!
  dataset: 'production',
  apiVersion: '2024-03-01',
  useCdn: false,
});

// Build using the explicit named export tool
const builder = createImageUrlBuilder(client);

export function urlFor(source: any) {
  return builder.image(source);
}