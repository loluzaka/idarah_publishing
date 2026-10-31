import type { Metadata } from 'next';
import Link from 'next/link';
import SanityImg from '@/app/components/SanityImage';
import { buildMetadata } from '@/app/lib/seo';
import { formatDate, getArticles } from '@/app/lib/articles';
import { SchemaOrg } from '@/components/seo/SchemaOrg';

// Must be a literal: Next reads route segment config statically. Keep in sync with ARTICLES_REVALIDATE.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const articles = await getArticles();
  return buildMetadata({
    title: 'Articles & Guides — Urdu Literature, Manuscripts and South Asian History',
    description:
      'Guides and essays from Idara Adabiyat Delhi on classical Urdu literature, rare manuscripts, South Asian history and poetry — with recommended books you can buy online.',
    path: '/articles',
    keywords: ['Urdu literature guide', 'rare Urdu manuscripts Delhi', 'South Asian history books', 'Urdu poetry recommended books'],
    // Don't ask search engines to index an empty listing.
    noIndex: articles.length === 0,
  });
}

export default async function ArticlesPage() {
  const articles = await getArticles();

  return (
    <>
      <SchemaOrg
        type="breadcrumb"
        items={[
          { name: 'Home', path: '/' },
          { name: 'Articles', path: '/articles' },
        ]}
      />
      <main className="mx-auto max-w-5xl px-6 py-12 font-serif text-[#1A1A1A]">
        <header className="mb-10 border-b border-[#1A1A1A]/10 pb-6">
          <span className="font-sans text-[9px] font-bold uppercase tracking-[0.25em] text-[#7D5A34]">Journal</span>
          <h1 className="mt-1 text-3xl font-normal tracking-tight md:text-4xl">Articles &amp; Guides</h1>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-[#1A1A1A]/60">
            Essays on classical Urdu literature, rare manuscripts and South Asian history from Idarah-e-Adabiyat-e-Delhi,
            with the books they discuss.
          </p>
        </header>

        {articles.length === 0 ? (
          <p className="py-16 text-center font-sans text-sm italic text-[#1A1A1A]/50">Articles are coming soon.</p>
        ) : (
          <ul className="grid gap-8 md:grid-cols-2">
            {articles.map((a) => (
              <li key={a._id}>
                <article className="group h-full">
                  <Link href={`/articles/${a.slug}`} className="block">
                    {a.mainImage && (
                      <div className="relative mb-4 aspect-[16/9] overflow-hidden bg-[#1A1A1A]/5">
                        <SanityImg image={a.mainImage} alt={a.mainImage.alt || a.title} fill sizes="(min-width: 768px) 480px, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                      </div>
                    )}
                    <h2 className="text-xl font-bold leading-snug group-hover:text-[#7D5A34] md:text-2xl" dir="auto">{a.title}</h2>
                    {a.excerpt && <p className="mt-2 line-clamp-3 font-sans text-sm leading-relaxed text-[#1A1A1A]/65" dir="auto">{a.excerpt}</p>}
                    <p className="mt-3 font-sans text-[11px] uppercase tracking-wider text-[#1A1A1A]/45">
                      <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
                    </p>
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
