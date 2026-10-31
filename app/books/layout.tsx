import type { Metadata } from 'next';
import { buildMetadata, SITE } from '@/app/lib/seo';

// These pages are client components, so their metadata lives in this layout.
// /books has child pages (/books/[id]). A nested layout that sets a plain string title
// drops the root title template, so re-declare it here for the children.
const base = buildMetadata({
  title: "Urdu, Arabic & Persian Books Online \u2014 Full Catalogue",
  description: "Browse the complete Idara Adabiyat Delhi catalogue: classical Urdu literature, Persian and Arabic works, Islamic history, poetry and academic publications. Buy books online with delivery across India.",
  path: "/books",
  keywords: ["Urdu bookstore online India", "buy classical Urdu literature books", "Islamic history books online", "Urdu academic publications Delhi", "Persian manuscripts India", "Ghalib rare books", "Urdu books catalogue"],
});

export const metadata: Metadata = {
  ...base,
  title: { default: base.title as string, template: `%s | ${SITE.titleSuffix}` },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
