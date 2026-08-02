"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { client, urlFor } from '@/app/sanityClient';

const BookModal = dynamic(() => import('@/app/components/BookModal'), { ssr: false });
import { CartItem, readCart, writeCart } from '@/app/lib/cart';
import { isPurchasable } from '@/app/lib/stock';
import { Layers } from 'lucide-react';
import { useUserProfile } from '@/app/hooks/useUserProfile';
import { customerPrice } from '@/app/lib/pricing';

interface CollectionBook {
  _id: string;
  title: string;
  author?: string | null;
  isbn?: string;
  series?: string;
  language?: string;
  price: number;
  originalPrice?: number;
  stock?: number;
  coverImage?: any;
  coverPlaceholder?: string;
}

interface Collection {
  _id: string;
  title: string;
  slug: { current: string };
  description?: string;
  bannerImage?: any;
  displayStyle?: string;
  books: CollectionBook[];
}

export default function CollectionClient({ slug }: { slug: string }) {
  const { discountRate } = useUserProfile();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    setCart(readCart());

    const handleOpenBook = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.bookId) setSelectedBookId(detail.bookId);
    };
    window.addEventListener('openBookModal', handleOpenBook);
    return () => window.removeEventListener('openBookModal', handleOpenBook);
  }, []);

  useEffect(() => {
    if (!slug) return;
    const fetchCollection = async () => {
      setLoading(true);
      try {
        const data: Collection | null = await client.fetch(
          `*[_type == "collection" && slug.current == $slug && enabled == true][0]{
            _id, title, slug, description, bannerImage, displayStyle,
            "books": books[]->{
              _id, title,
              "author": author->name,
              isbn, series, language,
              price, originalPrice, stock, coverImage, coverPlaceholder
            }
          }`,
          { slug }
        );
        setCollection(data ?? null);
      } catch (err) {
        console.error('Collection fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCollection();
  }, [slug]);

  const addToCart = (book: CollectionBook) => {
    const priced = customerPrice(book.price, book.originalPrice, discountRate);
    setCart(prev => {
      const ex = prev.find(i => i.id === book._id);
      const updated = ex
        ? prev.map(i => i.id === book._id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { id: book._id, title: book.title, author: book.author ?? '', price: priced.finalPrice, quantity: 1 }];
      writeCart(updated);
      return updated;
    });
    setCartOpen(true);
  };

  const subtotal = cart.reduce((t, i) => t + i.price * i.quantity, 0);
  const cartCount = cart.reduce((t, i) => t + i.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center">
        <p className="font-sans text-xs uppercase tracking-widest text-[#1A1A1A]/40 animate-pulse">Loading Collection…</p>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center font-serif text-[#1A1A1A]">
        <div className="text-center">
          <p className="font-sans text-sm text-[#1A1A1A]/50 mb-4">Collection not found.</p>
          <a href="/books" className="font-sans text-xs font-bold uppercase tracking-widest text-[#7D5A34] hover:underline">← Back to Catalog</a>
        </div>
      </div>
    );
  }

  const bannerUrl = collection.bannerImage?.asset
    ? (() => { try { return urlFor(collection.bannerImage).width(1920).height(420).url(); } catch { return null; } })()
    : null;

  const books = collection.books ?? [];

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] font-serif selection:bg-[#7D5A34]/20">

      {/* Banner */}
      <div
        className="w-full h-48 md:h-72 relative overflow-hidden flex items-end"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: '#1A1A1A' }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/80 via-[#1A1A1A]/30 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6 pb-10 w-full">
          <a href="/books" className="font-sans text-[10px] uppercase tracking-widest text-white/50 hover:text-white transition-colors block mb-2">← All Publications</a>
          <span className="font-sans text-[10px] uppercase tracking-[0.25em] font-bold text-[#7D5A34] block mb-1">Collection</span>
          <h1 className="text-3xl md:text-4xl font-normal text-white tracking-tight leading-tight">{collection.title}</h1>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row gap-12">

        {/* Books grid */}
        <div className="flex-grow lg:max-w-[72%]">
          {/* Collection info */}
          <div className="border-b border-[#1A1A1A]/10 pb-6 mb-8 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-[#7D5A34]" strokeWidth={1.5} />
                <span className="font-sans text-[9px] uppercase tracking-[0.25em] font-bold text-[#7D5A34]">Collection</span>
              </div>
              {collection.description && (
                <p className="font-sans text-sm text-[#1A1A1A]/70 leading-relaxed max-w-2xl">{collection.description}</p>
              )}
              <p className="font-sans text-[10px] uppercase tracking-wider text-[#1A1A1A]/40 mt-2">
                {books.length} publication{books.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {books.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-[#1A1A1A]/10">
              <p className="font-sans text-xs text-[#1A1A1A]/40 italic">No books in this collection yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {books.map(book => {
                const priced = customerPrice(book.price, book.originalPrice, discountRate);
                const onSale = priced.isDiscounted;
                const canBuy = isPurchasable(book.stock);
                const coverUrl = book.coverImage?.asset
                  ? (() => { try { return urlFor(book.coverImage).width(400).url(); } catch { return null; } })()
                  : null;

                return (
                  <div key={book._id} className="group flex flex-col justify-between border border-[#1A1A1A]/5 p-4 bg-[#1A1A1A]/[0.01] hover:bg-white hover:shadow-sm transition-all duration-300 relative">
                    <button onClick={() => setSelectedBookId(book._id)} className="cursor-pointer text-left block flex-grow w-full bg-transparent">
                      <div className="aspect-[3/4] bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 w-full mb-4 flex items-center justify-center relative overflow-hidden">
                        {coverUrl ? (
                          <img src={coverUrl} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <span className="text-4xl opacity-20 font-bold">{book.coverPlaceholder || 'IAD'}</span>
                        )}
                      </div>
                      <h4 className="text-base font-bold leading-snug group-hover:text-[#7D5A34] transition-colors">{book.title}</h4>
                      <p className="font-sans text-xs text-[#1A1A1A]/70 mt-1">By {book.author ?? 'Unknown'}</p>
                      {book.isbn && <p className="font-mono text-[8px] text-[#1A1A1A]/40 mt-1.5 uppercase">ISBN: {book.isbn}</p>}
                      {book.language && <p className="font-sans text-[8px] text-[#1A1A1A]/40 mt-0.5 uppercase tracking-wider">{book.language}</p>}
                    </button>

                    <div className="border-t border-[#1A1A1A]/10 pt-3 mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans text-base font-bold">₹{priced.finalPrice}</span>
                        {onSale && priced.originalPrice != null && <span className="font-sans text-sm text-[#1A1A1A]/50 line-through">₹{priced.originalPrice}</span>}
                      </div>
                      <button
                        onClick={() => canBuy && addToCart(book)}
                        disabled={!canBuy}
                        className="font-sans text-[11px] font-bold uppercase tracking-widest border border-[#1A1A1A] px-3 py-1.5 hover:bg-[#1A1A1A] hover:text-[#FBFBFA] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {canBuy ? 'Add to Cart' : 'Sold Out'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart sidebar */}
        <div className="w-full lg:w-[28%] flex flex-col gap-6 lg:sticky lg:top-[200px] h-fit self-start">
          <div className="p-5 border border-[#7D5A34]/20 bg-[#7D5A34]/[0.02] flex flex-col justify-between">
            <h4 className="font-sans text-[11px] font-bold tracking-widest uppercase text-[#7D5A34] mb-2">How To Order</h4>
            <p className="text-[11px] text-[#1A1A1A]/70 leading-relaxed font-sans mb-4">Compile your selection and forward it via WhatsApp.</p>
            <a href="/how-to-order" className="block text-center font-sans text-[10px] font-bold uppercase tracking-widest bg-[#7D5A34] text-white py-2.5 hover:bg-[#1A1A1A] transition-colors">Shipping Terms</a>
          </div>

          {cartCount > 0 && (
            <div className="bg-white border border-[#1A1A1A]/10 p-5 shadow-sm">
              <h3 className="font-sans text-xs font-bold tracking-widest uppercase border-b pb-2 mb-3">Your Selection ({cartCount})</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between text-xs font-sans border-b border-[#1A1A1A]/5 pb-2">
                    <div>
                      <p className="font-serif font-bold truncate max-w-[130px]">{item.title}</p>
                      <p className="text-[10px] text-[#1A1A1A]/50 mt-0.5">Qty {item.quantity}</p>
                    </div>
                    <span className="font-semibold flex-shrink-0 ml-2">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs font-bold pt-3 border-t mt-3">
                <span>Subtotal</span><span>₹{subtotal}</span>
              </div>
              <a href="/checkout" className="block text-center w-full bg-[#1A1A1A] text-white py-3 text-xs tracking-widest font-bold uppercase mt-3 hover:bg-[#7D5A34] transition-colors">Checkout</a>
            </div>
          )}
        </div>
      </main>

      {selectedBookId && (
        <BookModal
          bookId={selectedBookId}
          onClose={() => setSelectedBookId(null)}
          onAddToCart={bookId => {
            const b = books.find(b => b._id === bookId);
            if (b) addToCart(b);
          }}
        />
      )}
    </div>
  );
}
