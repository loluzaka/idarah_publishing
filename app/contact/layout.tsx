import type { Metadata } from 'next';
import { buildMetadata } from '@/app/lib/seo';

// These pages are client components, so their metadata lives in this layout.
export const metadata: Metadata = buildMetadata({
  title: "Contact Us & Order Enquiries",
  description: "Contact Idara Adabiyat Delhi (Idarah Books) for order enquiries, rare-book requests, bulk and library purchases, and shipping questions.",
  path: "/contact",
  keywords: ["contact Idara Adabiyat Delhi", "Urdu bookstore Delhi contact", "bulk book orders India"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
