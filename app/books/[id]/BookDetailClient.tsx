"use client";

import Link from 'next/link';
import React, { useState } from 'react';
import SanityImg from '../../components/SanityImage';
import { stackedAuthors } from '../../lib/authors';
import { readCart, writeCart } from '../../lib/cart';
import type { SanityImage } from '../../lib/sanity-types';

export interface BookDetail {
  _id: string;
  title: string;
  authors?: string[] | null;
  series?: string;
  price: number;
  originalPrice?: number;
  description?: string;
  pages?: number;
  binding?: string;
  publisher?: string;
  year?: string;
  language?: string;
  stock?: number;
  isSet?: boolean;
  volumes?: { _key?: string; volumeNumber?: number; title?: string; pages?: number; description?: string }[] | null;
  category?: { title: string } | null;
  categories?: { title: string; slug?: string }[] | null;
  coverPlaceholder?: string;
  coverImage?: SanityImage;
}

// Interactive half of /books/[id]. The page itself is a server component (so the
// title, description and JSON-LD are in the HTML crawlers fetch); this part
// is still server-rendered, then hydrates for the add-to-basket button.
export default function BookDetailClient({ book }: { book: BookDetail }) {
  const [addedToCart, setAddedToCart] = useState(false);

  const handleAddToCart = () => {
    const currentCart = readCart();
    const existingItem = currentCart.find(item => item.id === book._id);
    const updatedCart = existingItem
      ? currentCart.map(item => item.id === book._id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...currentCart, { id: book._id, title: book.title, authors: book.authors ?? [], price: book.price, quantity: 1 }];

    writeCart(updatedCart);
    
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] font-serif py-12 px-6 selection:bg-[#7D5A34]/20">
      <div className="max-w-5xl mx-auto">
        
        {/* BACK NAV BAR */}
        <div className="mb-8">
          <Link href="/books" className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors inline-flex items-center gap-2">
            ← Back to Publications Archive
          </Link>
        </div>

        {/* TWO COLUMN GRID PROFILE */}
        <div className="flex flex-col md:flex-row gap-12 lg:gap-16 items-start bg-white border border-[#1A1A1A]/10 p-6 md:p-10 shadow-sm">
          
          {/* LEFT: BOOK ART IMAGE PANEL */}
          <div className="w-full md:w-[35%] bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 aspect-[3/4] flex items-center justify-center relative overflow-hidden flex-shrink-0">
            {(book.categories?.[0]?.title ?? book.category?.title) && (
              <span className="absolute top-3 left-3 z-10 font-sans text-[9px] font-bold uppercase bg-[#7D5A34]/10 text-[#7D5A34] px-2 py-0.5 tracking-wider">
                {book.categories?.[0]?.title ?? book.category?.title}
              </span>
            )}
            {book.coverImage ? (
              // LCP element of the page: preloaded, sized to the 35% column.
              <SanityImg image={book.coverImage} alt={book.title} fill preload sizes="(min-width: 768px) 360px, 90vw" className="object-cover" />
            ) : (
              <span className="text-5xl opacity-20 font-bold">{book.coverPlaceholder || "IAD"}</span>
            )}
          </div>

          {/* RIGHT: COMPREHENSIVE TEXT METADATA */}
          <div className="flex-grow space-y-6">
            <div>
              {book.series && (
                <span className="font-sans text-xs uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">
                  {book.series}
                </span>
              )}
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight leading-tight mb-2">
                {book.title}
              </h1>
              <p className="font-sans text-xs md:text-sm text-[#1A1A1A]/60 mt-1 whitespace-pre-line leading-relaxed">
                {stackedAuthors(book.authors)}
              </p>
            </div>

            {/* PRICE & DIRECT CALL ACTIONS */}
            <div className="border-y border-[#1A1A1A]/10 py-4 flex flex-wrap items-center justify-between gap-4">
              <span className="text-2xl font-sans font-bold text-[#1A1A1A]">
                ₹{book.price}
              </span>
              
              <button 
                onClick={handleAddToCart}
                className={`font-sans text-xs font-bold uppercase tracking-widest border px-6 py-3.5 transition-all duration-300 min-w-[160px] ${
                  addedToCart 
                    ? 'bg-[#7D5A34] text-white border-[#7D5A34]' 
                    : 'bg-[#1A1A1A] text-white border-[#1A1A1A] hover:bg-transparent hover:text-[#1A1A1A]'
                }`}
              >
                {addedToCart ? "✓ Added" : "Add to Basket"}
              </button>
            </div>

            {/* EXPANDED ACADEMIC SYNOPSIS */}
            <div className="space-y-2">
              <h3 className="font-sans text-xs font-bold tracking-widest uppercase text-[#1A1A1A]/50">
                Editorial Synopsis
              </h3>
              <p className="text-sm leading-relaxed text-[#1A1A1A]/80 font-sans tracking-wide">
                {book.description || "Detailed source monograph registry data and translation indexes for this volume are currently being annotated by our editorial board."}
              </p>
            </div>

            {/* MULTI-VOLUME SET: volumes are shown here but sold only together */}
            {book.isSet && (book.volumes?.length ?? 0) > 0 && (
              <div className="border border-[#7D5A34]/25 bg-[#7D5A34]/[0.04] p-5">
                <h3 className="font-sans text-xs font-bold tracking-widest uppercase text-[#7D5A34]">
                  Complete set · {book.volumes!.length} volumes
                </h3>
                <p className="mt-1 mb-4 font-sans text-xs text-[#1A1A1A]/55">Sold as a complete set only. Volumes are not sold individually.</p>
                <ol className="space-y-3">
                  {[...book.volumes!].sort((a, b) => (a.volumeNumber ?? 0) - (b.volumeNumber ?? 0)).map((v, i) => (
                    <li key={v._key ?? i} className="flex items-start gap-3 font-sans">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#7D5A34] text-xs font-bold text-white">
                        {v.volumeNumber ?? i + 1}
                      </span>
                      <span className="text-sm leading-snug">
                        <span className="font-bold">{v.title || `Volume ${v.volumeNumber ?? i + 1}`}</span>
                        {v.pages ? <span className="text-[#1A1A1A]/50"> · {v.pages} pages</span> : null}
                        {v.description ? <span className="mt-0.5 block text-[#1A1A1A]/65">{v.description}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* DETAILED TECHNICAL MONOGRAPH SHEET */}
            <div className="pt-4 space-y-3">
              <h3 className="font-sans text-xs font-bold tracking-widest uppercase text-[#1A1A1A]/50 border-b border-[#1A1A1A]/5 pb-1">
                Publication Details
              </h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 font-sans text-xs text-[#1A1A1A]/70">
                <div><span className="font-bold text-[#1A1A1A]/50 uppercase text-[10px] tracking-wider block">Publisher</span> {book.publisher || "Idarah-i Adabiyat-i Dilli"}</div>
                <div><span className="font-bold text-[#1A1A1A]/50 uppercase text-[10px] tracking-wider block">Release Year</span> {book.year || "Classic Edition"}</div>
                <div><span className="font-bold text-[#1A1A1A]/50 uppercase text-[10px] tracking-wider block">Format binding</span> {book.binding || "Hardbound / Library Edition"}</div>
                <div><span className="font-bold text-[#1A1A1A]/50 uppercase text-[10px] tracking-wider block">Page Extent</span> {book.pages ? `${book.pages} Pages` : "N/A"}</div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}