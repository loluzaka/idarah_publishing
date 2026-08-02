"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { client, urlFor } from '../../sanityClient';

interface Book {
  _id: string;
  title: string;
  author: string;
  series?: string;
  price: number;
  description?: string;
  pages?: number;
  binding?: string;
  publisher?: string;
  year?: string;
  category?: { title: string };
  coverPlaceholder?: string;
  coverImage?: any;
}

export default function BookDetailPage() {
  const { id } = useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchBookDetails = async () => {
      try {
        const data = await client.fetch(
          `*[_type == "book" && _id == $id][0]{
            ...,
            "author": author->name,
            "category": category->{title}
          }`,
          { id }
        );
        setBook(data);
      } catch (error) {
        console.error("Error pulling volume archives:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookDetails();
  }, [id]);

  const handleAddToCart = () => {
    if (!book) return;

    const localCart = localStorage.getItem('iad_cart');
    let currentCart = localCart ? JSON.parse(localCart) : [];
    
    const existingItem = currentCart.find((item: any) => item.id === book._id);
    if (existingItem) {
      currentCart = currentCart.map((item: any) =>
        item.id === book._id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      currentCart.push({ id: book._id, quantity: 1 });
    }

    localStorage.setItem('iad_cart', JSON.stringify(currentCart));
    
    // Dispatch a storage event to alert our global Top Bar badge counter instantly
    window.dispatchEvent(new Event('storage'));
    
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center font-sans text-xs tracking-widest uppercase text-[#1A1A1A]/50 animate-pulse">
        Retrieving Scholarly Dossier...
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex flex-col items-center justify-center font-serif text-center p-6">
        <h2 className="text-2xl font-bold mb-2">Volume Archive Not Found</h2>
        <p className="font-sans text-xs text-[#1A1A1A]/50 mb-6">The requested publication index record does not exist in the collection files.</p>
        <a href="/books" className="font-sans text-xs font-bold uppercase tracking-widest border border-[#1A1A1A] px-4 py-2 hover:bg-[#1A1A1A] hover:text-[#FBFBFA] transition-all">
          Return to Archive
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] font-serif py-12 px-6 selection:bg-[#7D5A34]/20">
      <div className="max-w-5xl mx-auto">
        
        {/* BACK NAV BAR */}
        <div className="mb-8">
          <a href="/books" className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors inline-flex items-center gap-2">
            ← Back to Publications Archive
          </a>
        </div>

        {/* TWO COLUMN GRID PROFILE */}
        <div className="flex flex-col md:flex-row gap-12 lg:gap-16 items-start bg-white border border-[#1A1A1A]/10 p-6 md:p-10 shadow-sm">
          
          {/* LEFT: BOOK ART IMAGE PANEL */}
          <div className="w-full md:w-[35%] bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 aspect-[3/4] flex items-center justify-center relative overflow-hidden flex-shrink-0">
            {book.category?.title && (
              <span className="absolute top-3 left-3 z-10 font-sans text-[9px] font-bold uppercase bg-[#7D5A34]/10 text-[#7D5A34] px-2 py-0.5 tracking-wider">
                {book.category.title}
              </span>
            )}
            {book.coverImage ? (
              <img 
                src={urlFor(book.coverImage).width(600).url()} 
                alt={book.title} 
                className="w-full h-full object-cover"
              />
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
              <p className="font-sans text-sm md:text-base text-[#7D5A34] font-medium">
                By {book.author}
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