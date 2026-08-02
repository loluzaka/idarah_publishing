import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from './lib/seo';
import { BookOpen, Home, Search } from 'lucide-react';

export const metadata: Metadata = buildMetadata({
  title: 'Page Not Found',
  description: 'The page you were looking for could not be found.',
  noIndex: true,
});

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center px-6 font-serif selection:bg-[#7D5A34]/20">
      <div className="text-center max-w-lg">

        <span className="font-sans text-[9px] uppercase tracking-[0.3em] font-bold text-[#7D5A34] block mb-3">
          404 — Not Found
        </span>

        <h1 className="text-4xl md:text-5xl font-normal tracking-tight mb-4 leading-tight">
          This page doesn't exist
        </h1>

        <p className="font-sans text-sm text-[#1A1A1A]/60 mb-10 leading-relaxed max-w-sm mx-auto">
          The page you're looking for may have been moved, renamed, or never existed. Try browsing our catalog instead.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-6 py-3 hover:bg-[#7D5A34] transition-colors"
          >
            <Home className="w-3.5 h-3.5" strokeWidth={2} /> Go Home
          </Link>
          <Link
            href="/books"
            className="flex items-center justify-center gap-2 font-sans text-[11px] font-bold uppercase tracking-widest border border-[#1A1A1A]/20 px-6 py-3 hover:bg-[#1A1A1A]/5 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" strokeWidth={2} /> Browse Catalog
          </Link>
          <Link
            href="/books?focus=search"
            className="flex items-center justify-center gap-2 font-sans text-[11px] font-bold uppercase tracking-widest border border-[#1A1A1A]/20 px-6 py-3 hover:bg-[#1A1A1A]/5 transition-colors"
          >
            <Search className="w-3.5 h-3.5" strokeWidth={2} /> Search
          </Link>
        </div>

        <p className="font-sans text-[10px] text-[#1A1A1A]/30 mt-12 uppercase tracking-widest">
          Idarah-i Adabiyat-i Dilli · Associated with Jayyad Press
        </p>
      </div>
    </div>
  );
}
