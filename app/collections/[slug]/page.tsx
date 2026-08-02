import type { Metadata } from 'next';
import { client, urlFor } from '@/app/sanityClient';
import { buildMetadata } from '@/app/lib/seo';
import CollectionClient from './CollectionClient';

interface Props {
  params: Promise<{ slug: string }>;
}

// Static-generate collection pages that exist at build time; new ones ISR on demand
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const col = await client.fetch(
      `*[_type == "collection" && slug.current == $slug && enabled == true][0]{ title, description, bannerImage }`,
      { slug }
    );
    if (!col) return buildMetadata({ title: 'Collection Not Found', noIndex: true });

    const image = col.bannerImage?.asset
      ? (() => { try { return urlFor(col.bannerImage).width(1200).height(630).url(); } catch { return undefined; } })()
      : undefined;

    return buildMetadata({
      title: col.title,
      description: col.description ?? `Explore the "${col.title}" collection — curated by Idarah-i Adabiyat-i Dilli.`,
      path: `/collections/${slug}`,
      image,
    });
  } catch {
    return buildMetadata({ title: 'Collection', path: `/collections/${slug}` });
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <CollectionClient slug={slug} />;
}
