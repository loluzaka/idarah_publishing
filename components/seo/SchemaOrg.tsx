import {
  articleJsonLd,
  bookJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  jsonLdString,
  organizationJsonLd,
  websiteJsonLd,
  type BookLD,
  type BreadcrumbItem,
  type FaqItem,
} from "@/app/lib/seo";

type ArticleProps = Parameters<typeof articleJsonLd>[0];

export type SchemaOrgProps =
  | { type: "organization" }
  | { type: "website" }
  | { type: "book"; book: BookLD }
  | { type: "breadcrumb"; items: BreadcrumbItem[] }
  | { type: "faq"; items: FaqItem[] }
  | { type: "article"; article: ArticleProps };

/**
 * Renders one JSON-LD <script> (server component — the markup is in the HTML
 * crawlers fetch, not injected client-side).
 *
 *   <SchemaOrg type="organization" />
 *   <SchemaOrg type="book" book={{ _id, title, price, ... }} />
 *   <SchemaOrg type="faq" items={[{ question, answer }]} />
 */
export function SchemaOrg(props: SchemaOrgProps) {
  let data: unknown;
  switch (props.type) {
    case "organization": data = organizationJsonLd(); break;
    case "website": data = websiteJsonLd(); break;
    case "book": data = bookJsonLd(props.book); break;
    case "breadcrumb": data = breadcrumbJsonLd(props.items); break;
    case "article": data = articleJsonLd(props.article); break;
    case "faq": {
      // An empty FAQPage is invalid structured data — emit nothing instead.
      const faq = faqJsonLd(props.items);
      if (!faq.mainEntity.length) return null;
      data = faq;
      break;
    }
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}

export default SchemaOrg;
