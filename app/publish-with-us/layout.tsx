import type { Metadata } from 'next';
import { buildMetadata } from '@/app/lib/seo';

// These pages are client components, so their metadata lives in this layout.
export const metadata: Metadata = buildMetadata({
  title: "Publish With Us \u2014 Submit Your Manuscript",
  description: "Submit a manuscript to Idarah-e-Adabiyat-e-Delhi. We publish scholarly Urdu, Persian, Arabic and English works on literature, history and Islamic studies.",
  path: "/publish-with-us",
  keywords: ["Urdu book publisher India", "publish Urdu book Delhi", "submit manuscript Urdu publisher"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
