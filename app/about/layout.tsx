import type { Metadata } from 'next';
import { buildMetadata } from '@/app/lib/seo';

// These pages are client components, so their metadata lives in this layout.
export const metadata: Metadata = buildMetadata({
  title: "About Idara Adabiyat Delhi \u2014 Our Legacy & Mission",
  description: "The story of Idarah-e-Adabiyat-e-Delhi (Idara Adabiyat Delhi): a Delhi publishing house preserving Urdu, Persian and Arabic literature and South Asian heritage.",
  path: "/about",
  keywords: ["legacy of Idara Adabiyat Delhi", "Urdu publisher Delhi", "Delhi publishing house history", "preserving Urdu heritage"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
