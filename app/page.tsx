"use client";

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { client, urlFor } from './sanityClient';

const BookModal = dynamic(() => import('./components/BookModal'), { ssr: false });
import {
  getRecentlyViewedBooks,
  getRecentSearches,
  getRecommendations,
} from './lib/recommendations';
import { CartItem, writeCart, clearCart as clearCartStorage } from './lib/cart';
import { getRecommendedCollections, ScoredCollection } from './lib/recommendations';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  Truck,
  ArrowRight,
} from 'lucide-react';
import { useUserProfile } from './hooks/useUserProfile';
import { customerPrice } from './lib/pricing';

interface CollectionBook {
  _id: string;
  title: string;
  author?: string | null;
  price: number;
  originalPrice?: number;
  stock?: number;
  coverImage?: any;
}

interface Collection {
  _id: string;
  title: string;
  slug: { current: string };
  description?: string;
  bannerImage?: any;
  thumbnailImage?: any;
  displayStyle?: 'carousel' | 'grid' | 'featured_banner';
  featured?: boolean;
  priority?: number;
  books: CollectionBook[];
}

interface HomepageSlide {
  _key?: string;
  image?: any;
  heading?: string;
  subheading?: string;
  buttonText?: string;
  buttonLink?: string;
  priority?: number;
}

interface Book {
  _id: string;
  title: string;
  author: string;
  price: number;
  originalPrice?: number;
  series?: string;
  publisher?: string;
  description?: string;
  categories?: any[];
  coverPlaceholder?: string;
  coverImage?: any;
  homepageSlides?: HomepageSlide[];
}

// Unified slide shape used by the hero regardless of source (book, collection, fallback).
interface HeroSlide {
  key: string;
  image: any;
  href?: string;
  bookId?: string;
  alt: string;
  priority?: number;
}

// Display caps for homepage recommendation sections
const FOR_YOU_LIMIT = 3;

export default function HomePage() {
  const { discountRate } = useUserProfile();
  const [books, setBooks] = useState<Book[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartMaximized, setIsCartMaximized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const [featuredCollections, setFeaturedCollections] = useState<Collection[]>([]);

  const [viewedBooks] = useState(() => getRecentlyViewedBooks());
  const [recentSearches] = useState(() => getRecentSearches());
  const hasHistory = viewedBooks.length > 0 || recentSearches.length > 0;

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCurrentSlide((prev) => prev + 1);
    }, 5000);

    const localCart = localStorage.getItem('iad_cart');
    if (localCart) {
      setCart(JSON.parse(localCart));
      setIsCartOpen(true);
    }

    const fetchFeatured = async () => {
      try {
        const colData = await client.fetch(`
          *[_type == "collection" && enabled == true && featured == true] | order(priority asc) {
            _id, title, slug, description, bannerImage, thumbnailImage, displayStyle, featured, priority,
            "books": books[]->{
              _id, title,
              "author": author->name,
              price, originalPrice, stock, coverImage
            }
          }
        `);
        setFeaturedCollections(colData ?? []);

        const data = await client.fetch(`*[_type == "book"] {
  _id,
  title,
  "author": author->name,
  price,
  originalPrice,
  series,
  publisher,
  description,
  coverImage,
  "categories": categories[]->{_id, title, "slug": slug.current},
  homepageSlides
}`);
        setBooks(data);
      } catch (err) {
        console.error("Home query failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();

    const handleOpenBook = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.bookId) setSelectedBookId(detail.bookId);
    };
    window.addEventListener('openBookModal', handleOpenBook);

    return () => {
      clearInterval(slideTimer);
      window.removeEventListener('openBookModal', handleOpenBook);
    };
  }, []);

  // Full ranked recommendations (algorithm untouched — we just display fewer)
  const rankedRecommendations = useMemo(
    () => getRecommendations(books, viewedBooks, recentSearches),
    [books, viewedBooks, recentSearches]
  );

  // Homepage "For You" is capped at FOR_YOU_LIMIT cards.
  const recommendations = useMemo(
    () => rankedRecommendations.slice(0, FOR_YOU_LIMIT),
    [rankedRecommendations]
  );

  const hasRecommendations = recommendations.length > 0;

  const recommendedCollections = useMemo<ScoredCollection[]>(
    () => getRecommendedCollections(featuredCollections, books, viewedBooks, recentSearches),
    [featuredCollections, books, viewedBooks, recentSearches]
  );

  // ── Hero slides: 3-tier priority system ───────────────────────────────────
  //   Level 1: personalised slides derived from recommended books' homepageSlides.
  //   Level 2: featured collections with banners (when history yields no rec slides).
  //   Level 3: same collection banners for first-time visitors, plus book covers
  //            as a last-resort fill so new visitors still see a rich homepage.
  const heroSlides = useMemo<HeroSlide[]>(() => {
    // Level 1 — personalised from the ranked recommendation set
    const personalised: HeroSlide[] = [];
    for (const book of rankedRecommendations) {
      for (const slide of book.homepageSlides ?? []) {
        if (slide?.image) {
          personalised.push({
            key: `book-${book._id}-${slide._key ?? personalised.length}`,
            image: slide.image,
            bookId: book._id,
            alt: slide.heading || book.title || 'Personalised recommendation',
            priority: slide.priority,
          });
        }
      }
    }
    personalised.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

    if (personalised.length > 0 && hasHistory) return personalised;

    // Level 2 / 3 — featured collection banners
    const collectionSlides: HeroSlide[] = (featuredCollections ?? [])
      .filter(col => col?.bannerImage)
      .map(col => ({
        key: `col-${col._id}`,
        image: col.bannerImage,
        href: `/collections/${col.slug?.current ?? ''}`,
        alt: col.title || 'Featured collection',
        priority: col.priority,
      }));
    collectionSlides.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

    if (collectionSlides.length > 0) return collectionSlides;

    // Level 3 fallback — book covers when no banners exist yet
    return books.slice(0, 4)
      .filter(b => b.coverImage)
      .map(b => ({
        key: `cover-${b._id}`,
        image: b.coverImage,
        bookId: b._id,
        alt: b.title,
      }));
  }, [rankedRecommendations, featuredCollections, books, hasHistory]);

  const hasHeroSlides = heroSlides.length > 0;

  const addToCart = (book: Book) => {
    let updatedCart: CartItem[];
    const priced = customerPrice(book.price, book.originalPrice, discountRate);
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === book._id);
      if (existingItem) {
        updatedCart = prevCart.map((item) =>
          item.id === book._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        updatedCart = [
          ...prevCart,
          {
            id: book._id,
            title: book.title,
            author: book.author,
            price: priced.finalPrice,
            quantity: 1
          }
        ];
      }
      localStorage.setItem('iad_cart', JSON.stringify(updatedCart));
      setTimeout(() => { window.dispatchEvent(new Event('storage')); }, 0);
      return updatedCart;
    });
    setIsCartOpen(true);
  };

  const decreaseQuantity = (bookId: string) => {
    let updatedCart: CartItem[];
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === bookId);
      if (!existingItem) return prevCart;

      if (existingItem.quantity === 1) {
        updatedCart = prevCart.filter((item) => item.id !== bookId);
      } else {
        updatedCart = prevCart.map((item) =>
          item.id === bookId ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      localStorage.setItem('iad_cart', JSON.stringify(updatedCart));
      setTimeout(() => { window.dispatchEvent(new Event('storage')); }, 0);
      return updatedCart;
    });
  };

  const removeFromCart = (bookId: string) => {
    setCart(prev => {
      const updated = prev.filter(item => item.id !== bookId);
      writeCart(updated);
      return updated;
    });
  };

  const handleClearCart = () => {
    setCart([]);
    clearCartStorage();
    setIsCartOpen(false);
  };

  const tentativeSubtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  const renderBookCard = (book: Book) => {
    const priced = customerPrice(book.price, book.originalPrice, discountRate);
    const onSale = priced.isDiscounted;
    return (
      <div key={book._id} className="group flex flex-col justify-between border border-[#1A1A1A]/5 p-4 bg-[#1A1A1A]/[0.01] hover:bg-white hover:shadow-sm transition-all duration-300 relative animate-fade-in">
        <button
          onClick={() => setSelectedBookId(book._id)}
          className="cursor-pointer text-left block flex-grow w-full bg-transparent"
        >
          <div className="aspect-[3/4] bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 w-full mb-4 flex items-center justify-center relative overflow-hidden">
            {book.coverImage ? (
              <img src={urlFor(book.coverImage).width(400).url()} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <span className="text-4xl opacity-20 font-bold">{book.coverPlaceholder || "IAD"}</span>
            )}

            <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
              {book.categories?.some((c: any) => c.slug === 'new-arrivals') && (
                <span className="font-sans text-[8px] font-bold uppercase tracking-wider bg-white/95 text-[#7D5A34] border border-[#7D5A34]/20 px-1.5 py-0.5 rounded shadow-xs">New Arrival</span>
              )}
              {book.categories?.some((c: any) => c.slug === 'bestsellers') && (
                <span className="font-sans text-[8px] font-bold uppercase tracking-wider bg-[#1A1A1A]/95 text-white px-1.5 py-0.5 rounded shadow-xs">Bestseller</span>
              )}
            </div>
          </div>
          <h4 className="text-base font-bold leading-snug group-hover:text-[#7D5A34] transition-colors">{book.title}</h4>
          <p className="font-sans text-xs text-[#1A1A1A]/70 mt-1">By {book.author}</p>
        </button>

        <div className="border-t border-[#1A1A1A]/10 pt-3 mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-sans text-base font-bold">₹{priced.finalPrice}</span>
            {onSale && priced.originalPrice != null && (
              <span className="font-sans text-sm text-[#1A1A1A]/50 line-through">
                ₹{priced.originalPrice}
              </span>
            )}
          </div>
          <button onClick={() => addToCart(book)} className="font-sans text-[11px] font-bold uppercase tracking-widest border border-[#1A1A1A] px-3 py-1.5 hover:bg-[#1A1A1A] hover:text-[#FBFBFA] transition-all">
            Add to Cart
          </button>
        </div>
      </div>
    );
  };

  const activeSlide = hasHeroSlides ? heroSlides[currentSlide % heroSlides.length] : null;

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] font-serif selection:bg-[#7D5A34]/20 relative">

      {/* Hero — image-only, personalised → collection banners → cover fallback */}
      <section className="border-b border-[#1A1A1A]/10 py-6 px-6">
        {hasHeroSlides && activeSlide ? (
          <div className="max-w-7xl mx-auto relative">
            {(() => {
              const imgUrl = urlFor(activeSlide.image).width(1920).fit('max').url();
              const inner = (
                <img
                  src={imgUrl}
                  alt={activeSlide.alt}
                  className="w-full h-auto max-h-[280px] md:max-h-[340px] object-contain transition-opacity duration-500 group-hover:opacity-95"
                />
              );
              if (activeSlide.bookId) {
                return (
                  <button
                    onClick={() => setSelectedBookId(activeSlide.bookId!)}
                    className="block w-full group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7D5A34]"
                    aria-label={activeSlide.alt}
                  >
                    {inner}
                  </button>
                );
              }
              if (activeSlide.href) {
                return (
                  <a
                    href={activeSlide.href}
                    className="block w-full group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7D5A34]"
                    aria-label={activeSlide.alt}
                  >
                    {inner}
                  </a>
                );
              }
              return <div className="block w-full group">{inner}</div>;
            })()}

            {heroSlides.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentSlide(p => p - 1 + heroSlides.length)}
                  aria-label="Previous slide"
                  className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-[#1A1A1A] hover:bg-[#7D5A34] text-white shadow-md rounded-full p-2.5 transition-all cursor-pointer z-10 focus:outline-none"
                >
                  <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => setCurrentSlide(p => p + 1)}
                  aria-label="Next slide"
                  className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-[#1A1A1A] hover:bg-[#7D5A34] text-white shadow-md rounded-full p-2.5 transition-all cursor-pointer z-10 focus:outline-none"
                >
                  <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                </button>

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  {heroSlides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      aria-label={`Slide ${i + 1}`}
                      className={`w-8 h-1 rounded-sm transition-all duration-300 cursor-pointer ${(currentSlide % heroSlides.length) === i ? 'bg-[#7D5A34]' : 'bg-white/60'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          // Absolute-last fallback — only shown while data is still loading
          <div className="max-w-7xl mx-auto min-h-[220px] flex items-center justify-center">
            <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-[#1A1A1A]/30 animate-pulse">
              Loading featured content…
            </p>
          </div>
        )}
      </section>

      <main className="max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row gap-12">

        <div className="flex-grow lg:max-w-[72%]">

          {/* ── For You ── shown only when history produces results ── */}
          {!loading && hasRecommendations && (
            <div className="mb-14">
              <div className="border-b border-[#1A1A1A]/10 pb-4 mb-8">
                <h3 className="text-2xl font-normal">For You</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {recommendations.map(renderBookCard)}
              </div>
            </div>
          )}

          {/* ── Featured Collections from Sanity ── */}
          {!loading && featuredCollections.length > 0 && (
            <div className="mb-14">
              {(recommendedCollections.length > 0 ? recommendedCollections.map(sc => sc.collection) : featuredCollections).map((col: Collection) => {
                const books_ = col.books ?? [];
                if (books_.length === 0) return null;
                const style = col.displayStyle ?? 'carousel';
                const bannerUrl = col.bannerImage?.asset ? (() => { try { return urlFor(col.bannerImage).width(1920).height(380).url(); } catch { return null; } })() : null;

                return (
                  <div key={col._id} className="mb-12">
                    <div className="flex items-baseline justify-between border-b border-[#1A1A1A]/10 pb-4 mb-6">
                      <div>
                        <span className="font-sans text-[9px] uppercase tracking-[0.2em] font-bold text-[#7D5A34] block mb-1">
                          {recommendedCollections.some(sc => sc.collection._id === col._id) ? 'Recommended Collection' : 'Curated Collection'}
                        </span>
                        <h3 className="text-2xl font-normal">{col.title}</h3>
                        {col.description && <p className="font-sans text-[10px] text-[#1A1A1A]/50 mt-1 max-w-xl">{col.description}</p>}
                      </div>
                      <a href={`/collections/${col.slug?.current ?? ''}`} className="font-sans text-[10px] uppercase tracking-wider underline text-[#1A1A1A]/60 hover:text-[#7D5A34] flex-shrink-0">View All</a>
                    </div>

                    {style === 'featured_banner' && bannerUrl && (
                      <a href={`/collections/${col.slug?.current ?? ''}`} className="block relative w-full h-48 md:h-64 overflow-hidden group mb-6">
                        <img src={bannerUrl} alt={col.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A1A]/60 to-transparent flex items-center px-10">
                          <div>
                            <h4 className="text-white text-3xl font-normal font-serif">{col.title}</h4>
                            <span className="font-sans text-[10px] uppercase tracking-widest text-white/70 mt-2 block">{books_.length} publications →</span>
                          </div>
                        </div>
                      </a>
                    )}

                    {style === 'carousel' && (
                      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin">
                        {books_.slice(0, 10).map(book => {
                          const coverUrl = book.coverImage?.asset ? (() => { try { return urlFor(book.coverImage).width(200).url(); } catch { return null; } })() : null;
                          return (
                            <button
                              key={book._id}
                              onClick={() => setSelectedBookId(book._id)}
                              className="flex-shrink-0 w-36 text-left group"
                            >
                              <div className="aspect-[3/4] bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 w-full mb-2 overflow-hidden flex items-center justify-center">
                                {coverUrl ? <img src={coverUrl} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <span className="text-2xl opacity-20 font-bold">IAD</span>}
                              </div>
                              <p className="font-serif text-[11px] font-bold line-clamp-2 group-hover:text-[#7D5A34] transition-colors">{book.title}</p>
                              <p className="font-sans text-[10px] font-bold mt-0.5">₹{book.price}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {style === 'grid' && (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {books_.slice(0, 8).map(book => {
                          const coverUrl = book.coverImage?.asset ? (() => { try { return urlFor(book.coverImage).width(300).url(); } catch { return null; } })() : null;
                          return (
                            <button key={book._id} onClick={() => setSelectedBookId(book._id)} className="text-left group">
                              <div className="aspect-[3/4] bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 w-full mb-2 overflow-hidden flex items-center justify-center">
                                {coverUrl ? <img src={coverUrl} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <span className="text-2xl opacity-20 font-bold">IAD</span>}
                              </div>
                              <p className="font-serif text-xs font-bold line-clamp-2 group-hover:text-[#7D5A34] transition-colors">{book.title}</p>
                              <p className="font-sans text-[10px] font-bold mt-0.5">₹{book.price}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-b border-[#1A1A1A]/10 pb-4 mb-8">
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen className="w-4 h-4 text-[#7D5A34]" strokeWidth={1.5} />
              <span className="font-sans text-[9px] uppercase tracking-[0.25em] font-bold text-[#7D5A34]">Publications</span>
            </div>
            <h3 className="text-2xl font-normal">Featured Academic Publications</h3>
            <p className="font-sans text-[10px] uppercase tracking-wider text-[#1A1A1A]/50 mt-1">Exceptional translations and historical reference catalogs</p>
          </div>

          {loading ? (
            <p className="font-sans text-xs tracking-widest uppercase text-[#1A1A1A]/40 animate-pulse py-12 text-center">Loading Featured Monographs...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {books.slice(0, 6).map(renderBookCard)}
            </div>
          )}
        </div>

        {/* Right Sidebar — cart pinned above How To Order per design brief */}
        <div className="w-full lg:w-[28%] flex flex-col gap-6 lg:sticky lg:top-[200px] h-fit self-start transition-all duration-300">

          {/* ── Selection / Cart drawer ── (rendered first so it sits above How To Order) */}
          {isCartOpen && (
            <div className="bg-white border border-[#1A1A1A]/10 rounded-sm shadow-sm overflow-hidden transition-all duration-300">

              {/* Header — cream band, bronze avatar, serif title */}
              <div className="bg-[#7D5A34]/10 px-5 py-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#7D5A34] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <ClipboardList className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div className="flex-grow min-w-0">
                  <span className="block font-sans text-[10px] font-bold tracking-[0.25em] uppercase text-[#7D5A34]/80">
                    Your Cart
                  </span>
                  
                </div>
                <div className="flex items-center gap-2 text-[#1A1A1A]/50 flex-shrink-0">
                  <button
                    onClick={() => setIsCartMaximized(true)}
                    className="hover:text-[#7D5A34] transition-colors p-1 text-lg leading-none"
                    title="Maximize selection"
                    aria-label="Maximize selection"
                  >
                    ⛶
                  </button>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="hover:text-red-600 transition-colors p-1 text-lg leading-none"
                    title="Close selection"
                    aria-label="Close selection"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 pt-4 pb-3">
                {cart.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="font-sans text-[11px] text-[#1A1A1A]/40 italic mb-3">Your selection is empty.</p>
                    <a href="/books" className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#7D5A34] hover:underline">Browse Publications →</a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 pb-3 border-b border-[#1A1A1A]/5 last:border-b-0">
                        <div className="flex-grow min-w-0">
                          <p className="font-serif text-base font-normal leading-snug text-[#1A1A1A] truncate">{item.title}</p>
                          <div className="flex items-center gap-3 mt-2 font-sans text-sm text-[#1A1A1A]/70">
                            <button onClick={() => decreaseQuantity(item.id)} className="w-5 h-5 flex items-center justify-center select-none hover:text-[#7D5A34] transition-colors" aria-label="Decrease quantity">—</button>
                            <span className="font-semibold text-[#1A1A1A] min-w-[14px] text-center">{item.quantity}</span>
                            <button
                              onClick={() => { const b = books.find(b => b._id === item.id); if (b) addToCart(b); }}
                              className="w-5 h-5 flex items-center justify-center select-none hover:text-[#7D5A34] transition-colors"
                              aria-label="Increase quantity"
                            >+</button>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            title="Remove"
                            aria-label="Remove item"
                            className="text-[#1A1A1A]/30 hover:text-red-500 transition-colors text-sm leading-none"
                          >✕</button>
                          <span className="font-serif text-base text-[#1A1A1A]">₹{item.price * item.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <>
                  {/* Subtotal row — bronze icon + serif label + serif price to match the design */}
                  <div className="border-t border-[#1A1A1A]/10 px-5 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#7D5A34]/10 text-[#7D5A34] flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-4 h-4" strokeWidth={1.75} />
                    </div>
                    <span className="font-serif text-xl font-normal text-[#1A1A1A] flex-grow">
                      Subtotal
                    </span>
                    <span className="font-serif text-xl font-normal text-[#1A1A1A] tabular-nums">
                      ₹{tentativeSubtotal}
                    </span>
                  </div>

                  <a
                    href="/checkout"
                    className="block text-center bg-[#1A1A1A] text-white mx-5 py-3.5 font-sans text-xs font-bold uppercase tracking-widest hover:bg-[#7D5A34] transition-colors rounded-sm"
                  >
                    Review Invoice &amp; Checkout
                  </a>
                  <button
                    onClick={handleClearCart}
                    className="block w-full text-center font-sans text-[11px] font-bold uppercase tracking-widest text-[#1A1A1A]/50 hover:text-red-500 transition-colors py-3"
                  >
                    Clear Cart
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── How To Order — beneath the cart ── */}
          <div className="bg-white border border-[#1A1A1A]/10 rounded-sm shadow-sm overflow-hidden">
            <div className="bg-[#7D5A34]/5 border-b border-[#7D5A34]/15 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#7D5A34] text-white flex items-center justify-center">
                <ClipboardList className="w-4 h-4" strokeWidth={2} />
              </div>
              <div>
                <span className="block font-sans text-[9px] font-bold tracking-[0.25em] uppercase text-[#7D5A34]">Ordering Guide</span>
                <h4 className="font-serif text-base leading-tight text-[#1A1A1A]">How To Order</h4>
              </div>
            </div>

            <ol className="p-5 space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#1A1A1A]/5 text-[#7D5A34] flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-3.5 h-3.5" strokeWidth={2} />
                </div>
                <p className="font-sans text-[11px] leading-relaxed text-[#1A1A1A]/75">
                  Compile your selection from the catalog.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#1A1A1A]/5 text-[#7D5A34] flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-3.5 h-3.5" strokeWidth={2} />
                </div>
                <p className="font-sans text-[11px] leading-relaxed text-[#1A1A1A]/75">
                  Submit via WhatsApp or the checkout form.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#1A1A1A]/5 text-[#7D5A34] flex items-center justify-center flex-shrink-0">
                  <Truck className="w-3.5 h-3.5" strokeWidth={2} />
                </div>
                <p className="font-sans text-[11px] leading-relaxed text-[#1A1A1A]/75">
                  We verify stock, apply discounts, and quote India Post shipping.
                </p>
              </li>
            </ol>

            <a
              href="/how-to-order"
              className="group flex items-center justify-center gap-2 bg-[#1A1A1A] text-white hover:bg-[#7D5A34] font-sans text-[10px] font-bold uppercase tracking-widest py-3 transition-colors"
            >
              Full Shipping Terms
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
            </a>
          </div>
        </div>

      </main>

      {isCartMaximized && (
        <div className="fixed inset-0 bg-[#1a1a1a]/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-[#1A1A1A]/10 max-w-2xl w-full p-8 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setIsCartMaximized(false)}
              className="absolute top-6 right-8 text-xl text-[#1a1a1a]/50 hover:text-black hover:scale-110 transition-transform font-sans font-light"
            >
              ✕ Close Overlay
            </button>

            <div className="border-b pb-4 mb-6">
              <span className="font-sans text-[9px] uppercase tracking-[0.25em] font-bold text-[#7D5A34]">Pre-Invoice Summary</span>
              <h2 className="text-2xl font-normal tracking-tight mt-1">Review Selection Desk</h2>
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-[#1A1A1A]/40 font-sans text-xs uppercase tracking-wider">Your academic compilation drawer is currently empty</div>
            ) : (
              <div className="space-y-4">
                <div className="hidden sm:grid grid-cols-5 text-[10px] font-sans font-bold uppercase tracking-wider text-[#1a1a1a]/60 pb-2 border-b">
                  <div className="col-span-3">Item details</div>
                  <div className="text-center">Quantity</div>
                  <div className="text-right">Price</div>
                </div>

                {cart.map((item) => (
                  <div key={`max-home-${item.id}`} className="grid grid-cols-1 sm:grid-cols-5 items-center gap-3 sm:gap-0 py-3 border-b border-[#1A1A1A]/5 font-sans text-xs">
                    <div className="col-span-3">
                      <p className="font-serif font-bold text-sm text-[#1A1A1A]">{item.title}</p>
                      <p className="text-[10px] text-[#1A1A1A]/60 italic mt-0.5">By {item.author}</p>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => decreaseQuantity(item.id)} className="w-6 h-6 rounded-full border border-[#1A1A1A]/20 flex items-center justify-center hover:bg-[#1A1A1A] hover:text-[#FBFBFA] transition-all font-bold select-none">—</button>
                      <span className="font-bold min-w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => {
                          const bookObj = books.find(b => b._id === item.id);
                          if (bookObj) addToCart(bookObj);
                        }}
                        className="w-6 h-6 rounded-full border border-[#1A1A1A]/20 flex items-center justify-center hover:bg-[#1A1A1A] hover:text-[#FBFBFA] transition-all font-bold select-none"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right font-semibold text-sm">
                      ₹{item.price * item.quantity}
                    </div>
                  </div>
                ))}

                <div className="pt-6 flex flex-col items-end">
                  <div className="w-full sm:w-64 space-y-2 font-sans text-xs border-b pb-4 mb-6">
                    <div className="flex justify-between text-[#1A1A1A]/60"><span>Items Subtotal</span><span>₹{tentativeSubtotal}</span></div>
                    <div className="flex justify-between text-sm font-bold pt-1 text-[#7D5A34]"><span>Total Tentative Amount</span><span>₹{tentativeSubtotal}</span></div>
                  </div>

                  <div className="flex gap-4 w-full justify-end font-sans">
                    <button
                      onClick={() => setIsCartMaximized(false)}
                      className="border border-[#1A1A1A]/20 px-6 py-3 uppercase tracking-wider font-bold text-[10px] hover:bg-[#1A1A1A]/5 transition-colors"
                    >
                      Keep Browsing
                    </button>
                    <a
                      href="/checkout"
                      className="bg-[#1A1A1A] text-white px-6 py-3 uppercase tracking-wider font-bold text-[10px] hover:bg-[#7D5A34] transition-colors"
                    >
                      Proceed To Checkout
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedBookId && (
        <BookModal
          bookId={selectedBookId}
          onClose={() => setSelectedBookId(null)}
          onAddToCart={(bookId) => {
            const bk = books.find(b => b._id === bookId);
            if (bk) addToCart(bk);
          }}
        />
      )}
    </div>
  );
}
