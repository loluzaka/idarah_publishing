"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Fuse from 'fuse.js';
import { client, urlFor } from '../sanityClient';

const BookModal = dynamic(() => import('../components/BookModal'), { ssr: false });
import { addRecentSearch, getRecentSearches, clearRecentSearches } from '../lib/recommendations';
import { CartItem, writeCart, clearCart as clearCartStorage } from '../lib/cart';
import { buildFuseIndex, fuseSearch, SearchableBook } from '../lib/search';
import { Library, Search, ClipboardList, MessageCircle, Truck, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';
import { customerPrice } from '../lib/pricing';
import { isPurchasable } from '../lib/stock';

interface Category {
  _id: string;
  title: string;
  slug: { current: string };
  bannerImage?: any;
}

interface Book {
  _id: string;
  title: string;
  author?: string | null;
  isbn?: string;
  series?: string;
  publisher?: string;
  language?: string;
  price: number;
  originalPrice?: number;
  stock?: number;
  categories?: any[];
  coverPlaceholder?: string;
  coverImage?: any;
}

interface Theme {
  category: Category;
  books: Book[];
  anchor: string;
  coverImage?: any;
}

function themeAnchorId(slug: string) {
  return `theme-${slug}`;
}

function scrollToTheme(slug: string) {
  const el = document.getElementById(themeAnchorId(slug));
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function BooksPage() {
  const router = useRouter();
  const { discountRate } = useUserProfile();

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookCollectionMap, setBookCollectionMap] = useState<Map<string, string[]>>(new Map());

  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartMaximized, setIsCartMaximized] = useState(false);

  const [loading, setLoading] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [hoveredBook, setHoveredBook] = useState<string | null>(null);

  // Read search query from URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const q = p.get('q');
    if (q) setSearchQuery(q);
    if (p.get('focus') === 'search') {
      setTimeout(() => {
        searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        searchInputRef.current?.focus();
      }, 400);
    }
  }, []);

  // Debounced URL sync for search query
  const syncURL = useCallback(() => {
    const p = new URLSearchParams();
    if (searchQuery.trim()) p.set('q', searchQuery.trim());
    const qs = p.toString();
    router.replace(qs ? `/books?${qs}` : '/books', { scroll: false } as any);
  }, [searchQuery, router]);

  useEffect(() => {
    const t = setTimeout(syncURL, 300);
    return () => clearTimeout(t);
  }, [syncURL]);

  // Fetch data
  useEffect(() => {
    const localCart = localStorage.getItem('iad_cart');
    if (localCart) {
      try { setCart(JSON.parse(localCart)); setIsCartOpen(true); } catch {}
    }
    setRecentSearches(getRecentSearches());

    const fetchData = async () => {
      try {
        const [categoryData, bookData, collectionData] = await Promise.all([
          client.fetch(`*[_type == "category"]{_id, title, slug, bannerImage}`),
          client.fetch(`*[_type == "book"]{
            _id,
            title,
            price,
            originalPrice,
            stock,
            isbn,
            series,
            publisher,
            language,
            coverPlaceholder,
            coverImage,
            "author": author->name,
            "categories": categories[]->{_id, title, "slug": slug.current}
          }`),
          client.fetch(`*[_type == "collection" && enabled == true]{
            _id, title,
            "bookIds": books[]->_id
          }`),
        ]);

        setCategories(categoryData ?? []);
        setBooks(bookData ?? []);

        const map = new Map<string, string[]>();
        for (const col of (collectionData ?? [])) {
          for (const bookId of (col.bookIds ?? [])) {
            if (!bookId) continue;
            const existing = map.get(bookId) ?? [];
            existing.push(col.title);
            map.set(bookId, existing);
          }
        }
        setBookCollectionMap(map);
      } catch (err) {
        console.error('BooksPage fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const handleOpenBook = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.bookId) setSelectedBookId(detail.bookId);
    };
    window.addEventListener('openBookModal', handleOpenBook);
    return () => window.removeEventListener('openBookModal', handleOpenBook);
  }, []);

  // Fuse index for search
  const fuseIndex = useMemo<Fuse<SearchableBook> | null>(() => {
    if (books.length === 0) return null;
    const searchable: SearchableBook[] = books.map(b => ({
      ...b,
      collectionTitles: bookCollectionMap.get(b._id) ?? [],
      categories: (b.categories ?? []).map((c: any) => ({
        title: c?.title ?? '',
        slug: c?.slug ?? '',
      })),
    }));
    return buildFuseIndex(searchable);
  }, [books, bookCollectionMap]);

  // Group books into themes (categories that have books)
  const themes = useMemo<Theme[]>(() => {
    if (categories.length === 0 || books.length === 0) return [];
    const list: Theme[] = [];
    for (const cat of categories) {
      const slug = cat.slug?.current;
      if (!slug) continue;
      // Skip meta categories used for badging in book cards
      if (slug === 'new-arrivals' || slug === 'bestsellers') continue;
      const themeBooks = books.filter(b =>
        b.categories?.some((c: any) => c?.slug === slug || c?._id === cat._id)
      );
      if (themeBooks.length === 0) continue;
      // Use the category's own bannerImage (uploaded in Sanity Studio)
      const coverImage = cat.bannerImage ?? null;
      list.push({ category: cat, books: themeBooks, anchor: themeAnchorId(slug), coverImage });
    }
    return list;
  }, [categories, books]);

  // Auto-advance slideshow
  useEffect(() => {
    if (themes.length <= 1) return;
    const t = setInterval(() => setCurrentSlide(p => p + 1), 6000);
    return () => clearInterval(t);
  }, [themes.length]);

  // Search results — used when user is searching
  const searchResults = useMemo<Book[]>(() => {
    if (!searchQuery.trim() || !fuseIndex) return [];
    return fuseSearch(fuseIndex, searchQuery) as Book[];
  }, [searchQuery, fuseIndex]);

  const isSearching = searchQuery.trim() !== '';

  const featuredBooks = useMemo(
    () => books.filter(b => b.categories?.some((c: any) => c?.slug === 'new-arrivals')),
    [books]
  );

  // Cart handlers
  const addToCart = (book: Book) => {
    let updated: CartItem[];
    const priced = customerPrice(book.price, book.originalPrice, discountRate);
    setCart(prev => {
      const ex = prev.find(i => i.id === book._id);
      updated = ex
        ? prev.map(i => i.id === book._id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { id: book._id, title: book.title, author: book.author ?? '', price: priced.finalPrice, quantity: 1 }];
      writeCart(updated);
      return updated;
    });
    setIsCartOpen(true);
  };

  const decreaseQuantity = (bookId: string) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === bookId);
      if (!ex) return prev;
      const updated = ex.quantity === 1
        ? prev.filter(i => i.id !== bookId)
        : prev.map(i => i.id === bookId ? { ...i, quantity: i.quantity - 1 } : i);
      writeCart(updated);
      return updated;
    });
  };

  const removeFromCart = (bookId: string) => {
    setCart(prev => {
      const updated = prev.filter(i => i.id !== bookId);
      writeCart(updated);
      return updated;
    });
  };

  const handleClearCart = () => {
    setCart([]);
    clearCartStorage();
    setIsCartOpen(false);
  };

  const tentativeSubtotal = cart.reduce((t, i) => t + i.price * i.quantity, 0);

  const commitSearch = (term: string) => {
    const t = term.trim();
    if (!t) return;
    addRecentSearch(t);
    setRecentSearches(getRecentSearches());
  };

  const handleChipClick = (term: string) => {
    setSearchQuery(term);
    commitSearch(term);
    searchInputRef.current?.focus();
  };

  const renderPricing = (book: Book) => {
    const priced = customerPrice(book.price, book.originalPrice, discountRate);
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-sans text-base font-bold">₹{priced.finalPrice}</span>
        {priced.isDiscounted && priced.originalPrice != null && (
          <span className="font-sans text-sm text-[#1A1A1A]/50 line-through">₹{priced.originalPrice}</span>
        )}
      </div>
    );
  };

  const renderBookCard = (book: Book) => {
    const canBuy = isPurchasable(book.stock);
    return (
      <div key={book._id} className="group flex flex-col justify-between border border-[#1A1A1A]/5 p-4 bg-[#1A1A1A]/[0.01] hover:bg-white hover:shadow-sm transition-all duration-300 relative animate-fade-in">
        <button onClick={() => setSelectedBookId(book._id)} className="cursor-pointer text-left block flex-grow w-full bg-transparent">
          <div className="aspect-[3/4] bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 w-full mb-4 flex items-center justify-center relative overflow-hidden">
            {book.coverImage ? (
              <img src={urlFor(book.coverImage).width(400).url()} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <span className="text-4xl opacity-20 font-bold">{book.coverPlaceholder || 'IAD'}</span>
            )}
            {book.categories?.some((c: any) => c?.slug === 'new-arrivals') && (
              <span className="absolute top-2 left-2 font-sans text-[8px] font-bold uppercase tracking-wider bg-white/95 text-[#7D5A34] border border-[#7D5A34]/20 px-1.5 py-0.5 rounded shadow-xs">New</span>
            )}
          </div>
          <h4 className="text-base font-bold leading-snug group-hover:text-[#7D5A34] transition-colors">{book.title}</h4>
          <p className="font-sans text-xs text-[#1A1A1A]/70 mt-1">By {book.author ?? 'Unknown'}</p>
          {book.isbn && <p className="font-mono text-[8px] text-[#1A1A1A]/40 mt-1.5 uppercase">ISBN: {book.isbn}</p>}
          {book.language && <p className="font-sans text-[8px] text-[#1A1A1A]/40 mt-0.5 uppercase tracking-wider">{book.language}</p>}
        </button>
        <div className="border-t border-[#1A1A1A]/10 pt-3 mt-4 flex items-center justify-between">
          {renderPricing(book)}
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
  };

  const activeTheme = themes.length > 0 ? themes[currentSlide % themes.length] : null;

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] font-serif selection:bg-[#7D5A34]/20 relative">

      <main className="max-w-7xl mx-auto px-6 py-10 flex flex-col lg:flex-row gap-8">

        <div className="flex-grow min-w-0">

          {/* Page header */}
          <div className="border-b border-[#1A1A1A]/10 pb-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Library className="w-4 h-4 text-[#7D5A34]" strokeWidth={1.5} />
                  <span className="font-sans text-[9px] uppercase tracking-[0.25em] font-bold text-[#7D5A34]">Archive</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-normal tracking-tight mb-1">Catalogue</h2>
                <p className="font-sans text-[10px] uppercase tracking-wider text-[#1A1A1A]/50">
                  Browse our complete collection of historical literature
                </p>
              </div>
              <button
                onClick={() => window.open('/idarah-catalog-2026.pdf', '_blank')}
                className="font-sans text-[10px] font-bold uppercase tracking-wider border border-[#7D5A34] text-[#7D5A34] hover:bg-[#7D5A34] hover:text-[#FBFBFA] px-3 py-2 transition-all hidden sm:block"
              >
                PDF Catalog
              </button>
            </div>

            {/* Search — kept as the primary discovery tool */}
            <div className="mt-6">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#7D5A34] pointer-events-none" strokeWidth={2} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by title, author, ISBN, subject, language..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitSearch(searchQuery); }}
                  onBlur={() => commitSearch(searchQuery)}
                  aria-label="Search publications"
                  className="w-full bg-white border-2 border-[#1A1A1A]/15 focus:border-[#7D5A34] outline-none text-base py-4 pl-12 pr-12 font-serif tracking-wide transition-colors shadow-sm rounded-sm placeholder:text-[#1A1A1A]/35"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40 hover:text-red-500 transition-colors text-lg"
                  >✕</button>
                )}
              </div>
              {recentSearches.length > 0 && !searchQuery && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40">Recent:</span>
                  {recentSearches.slice(0, 6).map(term => (
                    <button
                      key={term}
                      onClick={() => handleChipClick(term)}
                      className="text-[10px] font-semibold bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 text-[#1A1A1A]/60 px-2.5 py-1 rounded-sm hover:bg-[#7D5A34]/10 hover:border-[#7D5A34]/30 hover:text-[#7D5A34] transition-all"
                    >
                      {term}
                    </button>
                  ))}
                  <button onClick={() => { clearRecentSearches(); setRecentSearches([]); }} className="text-[9px] uppercase tracking-widest text-[#1A1A1A]/30 hover:text-red-500 font-bold ml-1">
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ─── Search results view (only when searching) ─── */}
          {isSearching ? (
            <div>
              <div className="flex items-center justify-between mb-6 border-b border-[#1A1A1A]/5 pb-2">
                <h3 className="text-xl font-normal">Search Results</h3>
                <span className="font-sans text-[10px] uppercase tracking-wider text-[#1A1A1A]/40">
                  {loading ? '…' : `${searchResults.length} publication${searchResults.length !== 1 ? 's' : ''}`}
                </span>
              </div>
              {loading ? (
                <p className="font-sans text-xs tracking-widest uppercase text-[#1A1A1A]/40 animate-pulse py-12 text-center">Loading Archive Indexes...</p>
              ) : searchResults.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-[#1A1A1A]/10">
                  <p className="font-sans text-xs text-[#1A1A1A]/40 italic mb-3">No publications match your search.</p>
                  <button onClick={() => setSearchQuery('')} className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#7D5A34] hover:underline">Clear search</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {searchResults.map(renderBookCard)}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ─── Themed slideshow ─── */}
              {themes.length > 0 && activeTheme && (
                <section className="mb-14">
                  {(() => {
                    const bgUrl = activeTheme.coverImage
                      ? (() => { try { return urlFor(activeTheme.coverImage).width(1920).height(700).fit('crop').url(); } catch { return null; } })()
                      : null;
                    // 3 auto-picked book covers: prefer this theme's books, fall back to any book with a cover
                    const themeWithCovers = activeTheme.books.filter(b => b.coverImage);
                    const deskBooks = themeWithCovers.length > 0
                      ? themeWithCovers.slice(0, 3)
                      : books.filter(b => b.coverImage).slice(0, 3);

                    return (
                      <div className="relative overflow-hidden rounded-sm border border-[#1A1A1A]/10 shadow-sm">
                        {/* Admin-controlled banner background (the desk surface) */}
                        <div className="absolute inset-0">
                          {bgUrl ? (
                            <img
                              src={bgUrl}
                              alt=""
                              aria-hidden="true"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{ background: 'linear-gradient(135deg, #EFE9DF 0%, #E8DDD1 40%, #EDE5D8 100%)' }}
                            />
                          )}
                          {/* Soft parchment vignette so the covers pop against any banner */}
                          <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A1A]/45 via-[#1A1A1A]/15 to-[#1A1A1A]/25" />
                        </div>

                        <div className="relative flex flex-col md:flex-row items-center gap-0 min-h-[280px] md:min-h-[340px]">

                          {/* Left — 3D shelf: books tilted so both cover + spine are visible */}
                          <div
                            className="relative flex items-end justify-center w-full md:w-1/2 h-[260px] md:h-[360px] flex-shrink-0 px-4"
                            style={{ perspective: '1400px', perspectiveOrigin: '55% 60%' }}
                          >
                            {deskBooks.length === 0 ? (
                              <div className="flex items-center justify-center h-full">
                                <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-white/60">No publications yet</span>
                              </div>
                            ) : deskBooks.map((book, i) => {
                              const SPINE_WIDTH = 18;         // px — depth/thickness of the book
                              const BOOK_WIDTH_MD = 148;
                              const BOOK_WIDTH_SM = 118;
                              const restRotateY = 32;         // resting turn — spine visible on left
                              const restTiltZ = [-4, 0, 3];   // gentle stagger
                              const overlap = 78;             // px each subsequent book intrudes
                              const isHovered = hoveredBook === book._id;
                              const zIndex = isHovered ? 30 : (3 - i);
                              const imgUrl = book.coverImage?.asset
                                ? urlFor(book.coverImage).width(320).url()
                                : null;

                              // Deterministic spine colour derived from the book id — feels bookish
                              const spineTones = [
                                'linear-gradient(90deg, #3b2317 0%, #6b3f22 45%, #4a2c17 100%)',
                                'linear-gradient(90deg, #2a1f16 0%, #7D5A34 45%, #3a2a1c 100%)',
                                'linear-gradient(90deg, #241b14 0%, #5a3a24 45%, #2f2317 100%)',
                              ];
                              const spineBg = spineTones[book._id.charCodeAt(0) % spineTones.length];

                              return (
                                <button
                                  key={`${activeTheme.category._id}-${book._id}`}
                                  onClick={(e) => { e.stopPropagation(); setSelectedBookId(book._id); }}
                                  onMouseEnter={() => setHoveredBook(book._id)}
                                  onMouseLeave={() => setHoveredBook(null)}
                                  aria-label={`View ${book.title}`}
                                  className="absolute bottom-8 md:bottom-12 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7D5A34] cursor-pointer group/book"
                                  style={{
                                    left: '50%',
                                    marginLeft: `${(i - 1) * overlap - BOOK_WIDTH_MD / 2}px`,
                                    width: `${BOOK_WIDTH_MD}px`,
                                    height: `${(BOOK_WIDTH_MD * 4) / 3}px`,
                                    zIndex,
                                    transformStyle: 'preserve-3d',
                                    transform: isHovered
                                      ? `translateY(-24px) translateZ(60px) rotateY(6deg) rotateZ(0deg) scale(1.05)`
                                      : `rotateY(${restRotateY}deg) rotateZ(${restTiltZ[i]}deg)`,
                                    transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
                                  }}
                                >
                                  {/* SPINE — the thin strip attached to the left edge, extending backward */}
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      top: 0,
                                      width: `${SPINE_WIDTH}px`,
                                      height: '100%',
                                      transform: `rotateY(-90deg) translateX(-${SPINE_WIDTH / 2}px)`,
                                      transformOrigin: 'left center',
                                      background: spineBg,
                                      borderTopLeftRadius: '2px',
                                      borderBottomLeftRadius: '2px',
                                      boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.35), inset 2px 0 3px rgba(255,255,255,0.08)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {/* Spine text — vertical title with gold band */}
                                    <span
                                      style={{
                                        writingMode: 'vertical-rl',
                                        textOrientation: 'mixed',
                                        transform: 'rotate(180deg)',
                                        color: '#F5D7A1',
                                        fontFamily: 'var(--font-playfair), Georgia, serif',
                                        fontSize: '9px',
                                        fontWeight: 700,
                                        letterSpacing: '0.08em',
                                        textShadow: '0 1px 1px rgba(0,0,0,0.6)',
                                        padding: '10px 0',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxHeight: '90%',
                                      }}
                                    >
                                      {book.title}
                                    </span>
                                    {/* Top + bottom gold bands, hardback aesthetic */}
                                    <span style={{ position: 'absolute', top: '6px', left: '2px', right: '2px', height: '1px', background: '#F5D7A1', opacity: 0.5 }} />
                                    <span style={{ position: 'absolute', bottom: '6px', left: '2px', right: '2px', height: '1px', background: '#F5D7A1', opacity: 0.5 }} />
                                  </div>

                                  {/* COVER — the front face of the book */}
                                  <div
                                    style={{
                                      position: 'absolute',
                                      inset: 0,
                                      borderRadius: '2px',
                                      overflow: 'hidden',
                                      backfaceVisibility: 'hidden',
                                      boxShadow: isHovered
                                        ? '0 30px 60px rgba(0,0,0,0.55), 0 12px 24px rgba(0,0,0,0.35)'
                                        : '0 18px 32px rgba(0,0,0,0.45), 0 4px 8px rgba(0,0,0,0.25)',
                                      transition: 'box-shadow 0.35s ease',
                                    }}
                                  >
                                    {imgUrl ? (
                                      <img src={imgUrl} alt={book.title} className="w-full h-full object-cover" draggable={false} />
                                    ) : (
                                      <div className="w-full h-full bg-[#1A1A1A]/30 flex items-center justify-center">
                                        <span className="font-serif text-2xl text-white/40 font-bold">IAD</span>
                                      </div>
                                    )}
                                    {/* Subtle inner sheen — reads as a glossy hardback */}
                                    <div style={{
                                      position: 'absolute',
                                      inset: 0,
                                      background: 'linear-gradient(105deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0.15) 100%)',
                                      pointerEvents: 'none',
                                    }} />
                                  </div>
                                </button>
                              );
                            })}

                            {/* Shelf shadow — grounds the books on the "desk" */}
                            {deskBooks.length > 0 && (
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 w-[70%] h-4"
                                style={{
                                  background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 65%)',
                                  filter: 'blur(6px)',
                                  zIndex: 0,
                                }}
                              />
                            )}
                          </div>

                          {/* Right — editorial label + Explore CTA */}
                          <div className="w-full md:w-1/2 px-8 pb-8 md:py-10 md:pr-12 flex flex-col justify-center text-white text-right">
                            <span className="font-sans text-[9px] font-bold tracking-[0.35em] uppercase text-[#F5D7A1] block mb-3">
                              Theme {String((currentSlide % themes.length) + 1).padStart(2, '0')} / {String(themes.length).padStart(2, '0')}
                            </span>
                            <h2 className="font-serif text-3xl md:text-5xl font-normal leading-tight tracking-tight mb-3">
                              {activeTheme.category.title}
                            </h2>
                            <p className="font-sans text-xs md:text-sm text-white/80 leading-relaxed mb-6 max-w-md ml-auto">
                              {activeTheme.books.length} publication{activeTheme.books.length !== 1 ? 's' : ''} in this collection.
                              Click any cover to view its dossier, or explore the full theme below.
                            </p>
                            <button
                              onClick={() => scrollToTheme(activeTheme.category.slug.current)}
                              className="inline-flex items-center gap-2 self-end bg-white text-[#1A1A1A] hover:bg-[#7D5A34] hover:text-white font-sans text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-sm shadow-md transition-all"
                            >
                              Explore
                              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>

                        {/* Prev / next arrows */}
                        {themes.length > 1 && (
                          <>
                            <button
                              onClick={() => setCurrentSlide(p => p - 1 + themes.length)}
                              aria-label="Previous theme"
                              className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#1A1A1A] shadow-md rounded-full p-2.5 transition-all z-10"
                            >
                              <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={() => setCurrentSlide(p => p + 1)}
                              aria-label="Next theme"
                              className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#1A1A1A] shadow-md rounded-full p-2.5 transition-all z-10"
                            >
                              <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                            </button>

                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                              {themes.map((t, i) => (
                                <button
                                  key={t.category._id}
                                  onClick={() => setCurrentSlide(i)}
                                  aria-label={`Show ${t.category.title}`}
                                  className={`h-1.5 rounded-full transition-all ${(currentSlide % themes.length) === i ? 'w-8 bg-white' : 'w-3 bg-white/50 hover:bg-white/75'}`}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </section>
              )}

              {/* ─── Recent Acquisitions ─── */}
              {featuredBooks.length > 0 && (
                <section className="mb-16 border-b border-[#1A1A1A]/10 pb-12">
                  <div className="flex justify-between items-baseline mb-8">
                    <div>
                      <span className="font-sans text-[9px] uppercase tracking-[0.2em] font-bold text-[#7D5A34] block mb-1">Curated Selection</span>
                      <h3 className="text-2xl font-normal">Recent Acquisitions</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {featuredBooks.map(renderBookCard)}
                  </div>
                </section>
              )}

              {/* ─── Themed sections — anchor targets for Explore buttons ─── */}
              {loading ? (
                <p className="font-sans text-xs tracking-widest uppercase text-[#1A1A1A]/40 animate-pulse py-12 text-center">Loading Archive Indexes...</p>
              ) : themes.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-[#1A1A1A]/10">
                  <p className="font-sans text-xs text-[#1A1A1A]/40 italic">No publications available yet.</p>
                </div>
              ) : (
                themes.map((theme, i) => (
                  <section
                    key={theme.category._id}
                    id={theme.anchor}
                    className="mb-16 border-b border-[#1A1A1A]/10 pb-12 scroll-mt-32"
                  >
                    <div className="flex justify-between items-baseline mb-8">
                      <div>
                        <span className="font-sans text-[9px] uppercase tracking-[0.2em] font-bold text-[#7D5A34] block mb-1">
                          Theme {String(i + 1).padStart(2, '0')}
                        </span>
                        <h3 className="text-2xl md:text-3xl font-normal">{theme.category.title}</h3>
                        <p className="font-sans text-[10px] uppercase tracking-wider text-[#1A1A1A]/50 mt-1">
                          {theme.books.length} publication{theme.books.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                      {theme.books.map(renderBookCard)}
                    </div>
                  </section>
                ))
              )}
            </>
          )}
        </div>

        {/* Right Sidebar — cart pinned above How To Order */}
                <div className="w-full lg:w-[30%] flex-shrink-0 flex flex-col gap-6 lg:sticky lg:top-[180px] h-fit self-start">


          {isCartOpen && (
            <div className="bg-white border border-[#1A1A1A]/10 rounded-sm shadow-sm overflow-hidden transition-all duration-300 max-h-[calc(100vh-170px)] flex flex-col">
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
                  <button onClick={() => setIsCartMaximized(true)} className="hover:text-[#7D5A34] transition-colors p-1 text-lg leading-none" title="Maximize" aria-label="Maximize">⛶</button>
                  <button onClick={() => setIsCartOpen(false)} className="hover:text-red-600 transition-colors p-1 text-lg leading-none" title="Close" aria-label="Close">✕</button>
                </div>
              </div>

              <div className="px-5 pt-4 pb-3 max-h-[360px] overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="font-sans text-[11px] text-[#1A1A1A]/40 italic mb-3">Your selection is empty.</p>
                    <span className="font-sans text-[9px] uppercase tracking-widest text-[#7D5A34]">Browse above</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-start justify-between gap-3 pb-3 border-b border-[#1A1A1A]/5 last:border-b-0">
                        <div className="flex-grow min-w-0">
                          <p className="font-serif text-base font-normal leading-snug text-[#1A1A1A]">{item.title}</p>
                          <div className="flex items-center gap-3 mt-2 font-sans text-sm text-[#1A1A1A]/70">
                            <button onClick={() => decreaseQuantity(item.id)} className="w-5 h-5 flex items-center justify-center select-none hover:text-[#7D5A34] transition-colors" aria-label="Decrease quantity">—</button>
                            <span className="font-semibold text-[#1A1A1A] min-w-[14px] text-center">{item.quantity}</span>
                            <button onClick={() => { const b = books.find(b => b._id === item.id); if (b) addToCart(b); }} className="w-5 h-5 flex items-center justify-center select-none hover:text-[#7D5A34] transition-colors" aria-label="Increase quantity">+</button>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <button onClick={() => removeFromCart(item.id)} title="Remove" aria-label="Remove item" className="text-[#1A1A1A]/30 hover:text-red-500 transition-colors text-sm leading-none">✕</button>
                          <span className="font-serif text-base text-[#1A1A1A]">₹{item.price * item.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <>
                  <div className="border-t border-[#1A1A1A]/10 px-5 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#7D5A34]/10 text-[#7D5A34] flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-4 h-4" strokeWidth={1.75} />
                    </div>
                    <span className="font-serif text-xl font-normal text-[#1A1A1A] flex-grow">Subtotal</span>
                    <span className="font-serif text-xl font-normal text-[#1A1A1A] tabular-nums">₹{tentativeSubtotal}</span>
                  </div>
                  <a href="/cart" className="block text-center bg-[#1A1A1A] text-white mx-5 py-3.5 font-sans text-xs font-bold uppercase tracking-widest hover:bg-[#7D5A34] transition-colors rounded-sm">
                    COMPLETE ORDER
                  </a>
                  <button onClick={handleClearCart} className="block w-full text-center font-sans text-[11px] font-bold uppercase tracking-widest text-[#1A1A1A]/50 hover:text-red-500 transition-colors py-3">Clear Cart</button>
                </>
              )}
            </div>
          )}

        </div>
      </main>

      {isCartMaximized && (
        <div className="fixed inset-0 bg-[#1a1a1a]/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-[#1A1A1A]/10 max-w-2xl w-full p-8 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsCartMaximized(false)} className="absolute top-6 right-8 text-xl text-[#1a1a1a]/50 hover:text-black hover:scale-110 transition-transform font-sans font-light">✕ Close</button>
            <div className="border-b pb-4 mb-6">
              <span className="font-sans text-[9px] uppercase tracking-[0.25em] font-bold text-[#7D5A34]">Order Summary</span>
              <h2 className="text-2xl font-normal tracking-tight mt-1">Your Order</h2>
            </div>
            {cart.length === 0 ? (
              <div className="py-12 text-center text-[#1A1A1A]/40 font-sans text-xs uppercase tracking-wider">Your academic compilation drawer is currently empty</div>
            ) : (
              <div className="space-y-4">
                <div className="hidden sm:grid grid-cols-5 text-[10px] font-sans font-bold uppercase tracking-wider text-[#1a1a1a]/60 pb-2 border-b">
                  <div className="col-span-3">Book Title</div>
                  <div className="text-center">Quantity</div>
                  <div className="text-right">Price</div>
                </div>
                {cart.map(item => (
                  <div key={`max-${item.id}`} className="grid grid-cols-1 sm:grid-cols-5 items-center gap-3 sm:gap-0 py-3 border-b border-[#1A1A1A]/5 font-sans text-xs">
                    <div className="col-span-3">
                      <p className="font-serif font-bold text-sm text-[#1A1A1A]">{item.title}</p>
                      <p className="text-[10px] text-[#1A1A1A]/60 italic mt-0.5">By {item.author}</p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => decreaseQuantity(item.id)} className="w-6 h-6 rounded-full border border-[#1A1A1A]/20 flex items-center justify-center hover:bg-[#1A1A1A] hover:text-[#FBFBFA] transition-all font-bold select-none">—</button>
                      <span className="font-bold min-w-4 text-center">{item.quantity}</span>
                      <button onClick={() => { const b = books.find(b => b._id === item.id); if (b) addToCart(b); }} className="w-6 h-6 rounded-full border border-[#1A1A1A]/20 flex items-center justify-center hover:bg-[#1A1A1A] hover:text-[#FBFBFA] transition-all font-bold select-none">+</button>
                    </div>
                    <div className="text-right font-semibold text-sm">₹{item.price * item.quantity}</div>
                  </div>
                ))}
                <div className="pt-6 flex flex-col items-end">
                  <div className="w-full sm:w-64 space-y-2 font-sans text-xs border-b pb-4 mb-6">
                    <div className="flex justify-between text-[#1A1A1A]/60"><span>Subtotal</span><span>₹{tentativeSubtotal}</span></div>
                    <div className="flex justify-between text-sm font-bold pt-1 text-[#7D5A34]"><span>Total </span><span>₹{tentativeSubtotal}</span></div>
                  </div>
                  <div className="flex gap-4 w-full justify-end font-sans">
                    <button onClick={() => setIsCartMaximized(false)} className="border border-[#1A1A1A]/20 px-6 py-3 uppercase tracking-wider font-bold text-[10px] hover:bg-[#1A1A1A]/5 transition-colors">Keep Browsing</button>
                    <a href="/cart" className="bg-[#1A1A1A] text-white px-6 py-3 uppercase tracking-wider font-bold text-[10px] hover:bg-[#7D5A34] transition-colors">Proceed to Checkout</a>
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
          onAddToCart={bookId => { const b = books.find(b => b._id === bookId); if (b) addToCart(b); }}
        />
      )}
    </div>
  );
}
