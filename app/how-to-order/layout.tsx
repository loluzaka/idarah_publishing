import type { Metadata } from 'next';
import { buildMetadata } from '@/app/lib/seo';

// These pages are client components, so their metadata lives in this layout.
export const metadata: Metadata = buildMetadata({
  title: "How to Order Books Online \u2014 India & International Shipping",
  description: "How to buy Urdu, Persian and Arabic books from Idara Adabiyat Delhi: ordering, payment, India Post shipping rates, delivery times and international orders.",
  path: "/how-to-order",
  keywords: ["how to buy Urdu books online", "Urdu books shipping India", "international shipping Urdu books"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
