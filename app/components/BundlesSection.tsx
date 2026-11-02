"use client";

import React from 'react';
import { Boxes } from 'lucide-react';
import SanityImg from './SanityImage';
import { customerPrice } from '../lib/pricing';
import { isPurchasable } from '../lib/stock';
import type { SanityImage } from '../lib/sanity-types';

export interface BundleBook {
  _id: string;
  title: string;
  authors?: string[] | null;
  price: number;
  originalPrice?: number;
  stock?: number;
  coverImage?: SanityImage;
}

export interface Bundle {
  _id: string;
  name: string;
  description?: string;
  coverImage?: SanityImage;
  books: BundleBook[];
}

interface BundlesSectionProps {
  bundles: Bundle[];
  discountRate: number | null | undefined;
  onAddAll: (books: BundleBook[]) => void;
  onOpenBook: (bookId: string) => void;
}

/**
 * A quiet "Bundles & Sets" shelf for the foot of the catalogue. A bundle is a
 * convenience grouping: "Add all" puts each book in the cart at its normal price,
 * so nothing shown here can disagree with what checkout charges.
 */
export default function BundlesSection({ bundles, discountRate, onAddAll, onOpenBook }: BundlesSectionProps) {
  if (bundles.length === 0) return null;

  return (
    <section id="bundles" className="mb-16 scroll-mt-32" aria-label="Bundles and sets">
      <div className="mb-6">
        <span className="mb-1 flex items-center gap-1.5 font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-[#7D5A34]">
          <Boxes className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> Bundles &amp; Sets
        </span>
        <h3 className="text-2xl font-normal">Buy Them Together</h3>
        <p className="mt-1 font-sans text-[10px] uppercase tracking-wider text-[#1A1A1A]/50">
          Titles that belong on the same shelf
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {bundles.map((bundle) => {
          const books = bundle.books;
          const total = books.reduce((sum, b) => sum + customerPrice(b.price, b.originalPrice, discountRate).finalPrice, 0);
          const allAvailable = books.every((b) => isPurchasable(b.stock));
          const covers = books.filter((b) => b.coverImage).slice(0, 4);

          return (
            <article key={bundle._id} className="flex flex-col gap-4 border border-[#1A1A1A]/10 bg-white p-4 sm:flex-row">
              {/* Cover: the bundle's own image, else the first few book covers side by side */}
              <div className="relative flex h-40 w-full flex-shrink-0 items-center justify-center overflow-hidden border border-[#1A1A1A]/10 bg-[#F3EEE4] sm:h-auto sm:w-32">
                {bundle.coverImage ? (
                  <SanityImg image={bundle.coverImage} alt={bundle.name} fill sizes="128px" className="object-cover" />
                ) : (
                  <div className="flex -space-x-5 px-2">
                    {covers.map((b, i) => (
                      <div key={b._id} className="relative h-24 w-16 overflow-hidden border border-white shadow-md" style={{ zIndex: covers.length - i }}>
                        <SanityImg image={b.coverImage!} alt="" fill sizes="64px" className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-grow flex-col">
                <h4 className="text-lg font-bold leading-snug">{bundle.name}</h4>
                {bundle.description && (
                  <p className="mt-1 line-clamp-2 font-sans text-[11px] leading-snug text-[#1A1A1A]/60">{bundle.description}</p>
                )}

                <ul className="mt-3 space-y-1 font-sans text-[11px]">
                  {books.map((b) => (
                    <li key={b._id} className="flex items-baseline justify-between gap-3">
                      <button onClick={() => onOpenBook(b._id)} className="min-w-0 truncate text-left text-[#1A1A1A]/80 hover:text-[#7D5A34] hover:underline">
                        {b.title}
                      </button>
                      <span className="flex-shrink-0 text-[#1A1A1A]/45">₹{customerPrice(b.price, b.originalPrice, discountRate).finalPrice}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#1A1A1A]/10 pt-3">
                  <div className="font-sans">
                    <span className="block text-[9px] uppercase tracking-wider text-[#1A1A1A]/40">{books.length} books</span>
                    <span className="text-base font-bold">₹{total}</span>
                  </div>
                  <button
                    onClick={() => allAvailable && onAddAll(books)}
                    disabled={!allAvailable}
                    className="border border-[#1A1A1A] px-3 py-1.5 font-sans text-[11px] font-bold uppercase tracking-widest transition-all hover:bg-[#1A1A1A] hover:text-[#FBFBFA] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {allAvailable ? 'Add All to Cart' : 'Unavailable'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
