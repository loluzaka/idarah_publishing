import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PortableText, type PortableTextComponents } from 'next-sanity';
import { sanityImageUrl } from '@/app/sanityClient';
import SanityImg from '@/app/components/SanityImage';
import { buildMetadata, SITE } from '@/app/lib/seo';
import { formatDate, getArticle, getArticles } from '@/app/lib/articles';
import { SchemaOrg } from '@/components/seo/SchemaOrg';

interface Props {
  params: Promise<{ slug: string }>;
}

// Must be a literal: Next reads route segment config statically. Keep in sync with ARTICLES_REVALIDATE.
export const revalidate = 300;

// Pre-render what exists at build time; new articles render on first request (ISR).
export async function generateStaticParams() {
  return (await getArticles()).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return buildMetadata({ title: 'Article Not Found', noIndex: true });

  return buildMetadata({
    title: a.metaTitle || a.title,
    description: a.metaDescription || a.excerpt,
    path: `/articles/${a.slug}`,
    image: a.mainImage ? sanityImageUrl(a.mainImage, 1200, 630) ?? undefined : undefined,
    type: 'article',
    keywords: a.metaKeywords ?? undefined,
    publishedTime: a.publishedAt,
    modifiedTime: a._updatedAt,
    authors: a.authorName ? [a.authorName] : undefined,
  });
}

// Typography for Portable Text (the project has no @tailwindcss/typography).
const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p className="mb-5 text-[17px] leading-[1.75] text-[#1A1A1A]/85" dir="auto">{children}</p>,
    h2: ({ children }) => <h2 className="mt-12 mb-4 text-2xl md:text-3xl font-normal leading-snug text-[#1A1A1A]" dir="auto">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-8 mb-3 text-xl font-bold leading-snug text-[#1A1A1A]" dir="auto">{children}</h3>,
    blockquote: ({ children }) => (
      <blockquote className="my-8 border-l-2 border-[#7D5A34] pl-5 text-lg italic text-[#1A1A1A]/70" dir="auto">{children}</blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="mb-5 ml-6 list-disc space-y-2 text-[17px] leading-[1.7] text-[#1A1A1A]/85">{children}</ul>,
    number: ({ children }) => <ol className="mb-5 ml-6 list-decimal space-y-2 text-[17px] leading-[1.7] text-[#1A1A1A]/85">{children}</ol>,
  },
  marks: {
    link: ({ value, children }) => {
      const href: string = value?.href ?? '#';
      const external = /^https?:\/\//.test(href) && !href.startsWith(SITE.url);
      return (
        <a href={href} className="text-[#7D5A34] underline underline-offset-4 hover:text-[#1A1A1A]" {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}>
          {children}
        </a>
      );
    },
    // Inline link from the prose straight to a book's product page.
    bookLink: ({ value, children }) =>
      value?.bookId ? (
        <Link href={`/books/${value.bookId}`} className="font-semibold text-[#7D5A34] underline underline-offset-4 hover:text-[#1A1A1A]">
          {children}
        </Link>
      ) : (
        <>{children}</>
      ),
  },
  types: {
    image: ({ value }) =>
      value?.asset ? (
        <figure className="my-8">
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#1A1A1A]/5">
            <SanityImg image={value} alt={value.alt ?? ''} fill sizes="(min-width: 768px) 720px, 100vw" className="object-cover" />
          </div>
          {value.caption && <figcaption className="mt-2 text-center font-sans text-xs text-[#1A1A1A]/55">{value.caption}</figcaption>}
        </figure>
      ) : null,
  },
};

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();

  const path = `/articles/${a.slug}`;
  const faqs = (a.faqItems ?? []).filter((f) => f.question && f.answer);
  const related = a.relatedBooks ?? [];

  return (
    <>
      <SchemaOrg
        type="article"
        article={{
          title: a.title,
          description: a.metaDescription || a.excerpt,
          path,
          image: a.mainImage ? sanityImageUrl(a.mainImage, 1200, 630) ?? undefined : undefined,
          datePublished: a.publishedAt,
          dateModified: a._updatedAt,
          authorName: a.authorName,
          keywords: a.metaKeywords ?? undefined,
        }}
      />
      <SchemaOrg
        type="breadcrumb"
        items={[
          { name: 'Home', path: '/' },
          { name: 'Articles', path: '/articles' },
          { name: a.title, path },
        ]}
      />
      <SchemaOrg type="faq" items={faqs} />

      <article className="mx-auto max-w-3xl px-6 py-12 font-serif text-[#1A1A1A]">
        <nav aria-label="Breadcrumb" className="mb-8 font-sans text-[11px] uppercase tracking-wider text-[#1A1A1A]/50">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="hover:text-[#7D5A34]">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/articles" className="hover:text-[#7D5A34]">Articles</Link></li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-normal leading-tight tracking-tight md:text-5xl" dir="auto">{a.title}</h1>
          {a.excerpt && <p className="mt-4 text-lg leading-relaxed text-[#1A1A1A]/70" dir="auto">{a.excerpt}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-xs text-[#1A1A1A]/55">
            {a.authorName && (
              <address className="not-italic">
                By <span className="font-semibold text-[#1A1A1A]/80">{a.authorName}</span>
              </address>
            )}
            <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
            {a._updatedAt && new Date(a._updatedAt).getTime() - new Date(a.publishedAt).getTime() > 86_400_000 && (
              <span>Updated <time dateTime={a._updatedAt}>{formatDate(a._updatedAt)}</time></span>
            )}
          </div>
        </header>

        {a.mainImage && (
          <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden bg-[#1A1A1A]/5">
            <SanityImg image={a.mainImage} alt={a.mainImage.alt || a.title} fill preload sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
          </div>
        )}

        <div>{a.body && <PortableText value={a.body as never} components={components} />}</div>

        {related.length > 0 && (
          <section className="mt-14 border-t border-[#1A1A1A]/10 pt-10" aria-labelledby="related-books">
            <h2 id="related-books" className="mb-6 text-2xl font-normal">Books mentioned in this article</h2>
            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              {related.map((b) => (
                <li key={b._id}>
                  <Link href={`/books/${b._id}`} className="group block">
                    <div className="relative mb-2 aspect-[3/4] overflow-hidden border border-[#1A1A1A]/10 bg-[#1A1A1A]/5">
                      {b.coverImage?.asset && (
                        <SanityImg image={b.coverImage} alt={b.title} fill sizes="(min-width: 640px) 220px, 45vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm font-bold group-hover:text-[#7D5A34]" dir="auto">{b.title}</p>
                    {b.authors?.length ? <p className="mt-0.5 line-clamp-1 font-sans text-[11px] text-[#1A1A1A]/55">{b.authors.join(', ')}</p> : null}
                    <p className="mt-1 font-sans text-xs font-bold">₹{b.price}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {faqs.length > 0 && (
          <section className="mt-14 border-t border-[#1A1A1A]/10 pt-10" aria-labelledby="faq">
            <h2 id="faq" className="mb-6 text-2xl font-normal">Frequently asked questions</h2>
            <div className="space-y-6">
              {faqs.map((f, i) => (
                <div key={f._key ?? i}>
                  <h3 className="text-lg font-bold leading-snug" dir="auto">{f.question}</h3>
                  <p className="mt-2 text-[17px] leading-[1.7] text-[#1A1A1A]/80" dir="auto">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-14 border-t border-[#1A1A1A]/10 pt-6 font-sans text-xs">
          <Link href="/articles" className="font-bold uppercase tracking-widest text-[#7D5A34] hover:underline">← All articles</Link>
          <span className="mx-3 text-[#1A1A1A]/30">|</span>
          <Link href="/books" className="font-bold uppercase tracking-widest text-[#7D5A34] hover:underline">Browse the catalogue</Link>
        </footer>
      </article>
    </>
  );
}
