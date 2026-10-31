import type { Metadata } from 'next';
import { buildMetadata } from '@/app/lib/seo';

// These pages are client components, so their metadata lives in this layout.
export const metadata: Metadata = buildMetadata({
  title: "Authors, Scholars & Poets",
  description: "Meet the authors, historians and poets published by Idara Adabiyat Delhi (Idarah Books) \u2014 scholars of Urdu, Persian, Arabic and South Asian history.",
  path: "/authors",
  keywords: ["Urdu authors", "Urdu scholars Delhi", "Urdu poets books", "South Asian historians"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
