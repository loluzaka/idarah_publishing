"use client";

import React from 'react';
import { client, urlFor } from '@/app/sanityClient';
import { addRecentlyViewedBook } from '@/app/lib/recommendations';
import { useAuth } from '@/app/context/AuthContext';
import { addToWishlist, removeFromWishlist, isWishlisted } from '@/app/lib/wishlist';
import { getApprovedReviews, getUserReview, submitReview, averageRating, Review } from '@/app/lib/reviews';
import { stockLabel, isPurchasable, getStockStatus } from '@/app/lib/stock';
import { bookJsonLd, jsonLdString } from '@/app/lib/seo';
import { useUserProfile } from '@/app/hooks/useUserProfile';
import { customerPrice } from '@/app/lib/pricing';

interface Category {
  title: string;
  slug: { current: string };
}

interface BookDetail {
  _id: string;
  title: string;
  author: string;
  isbn?: string;
  series?: string;
  publisher?: string;
  year?: string;
  binding?: string;
  pages?: number;
  price: number;
  originalPrice?: number;
  stock?: number;
  description?: string;
  coverImage?: any;
  coverPlaceholder?: string;
  categories?: Category[];
  contentsImages?: any[];
  previewImages?: any[];
}

interface RelatedBook {
  _id: string;
  title: string;
  author: string;
  price: number;
  coverImage?: any;
}

interface BookModalProps {
  bookId: string;
  onClose: () => void;
  onAddToCart: (bookId: string) => void;
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value, max = 5, onSelect }: { value: number; max?: number; onSelect?: (v: number) => void }) {
  const [hovered, setHovered] = React.useState(0);
  const display = hovered || value;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onSelect?.(star)}
          onMouseEnter={() => onSelect && setHovered(star)}
          onMouseLeave={() => onSelect && setHovered(0)}
          className={`text-lg leading-none transition-colors select-none ${onSelect ? 'cursor-pointer' : 'cursor-default'} ${star <= display ? 'text-[#7D5A34]' : 'text-[#1A1A1A]/20'}`}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ─── Stock pill ───────────────────────────────────────────────────────────────

function StockPill({ stock }: { stock: number | undefined }) {
  const status = getStockStatus(stock);
  const label = stockLabel(stock);
  const colours: Record<string, string> = {
    in_stock: 'bg-green-50 text-green-700 border-green-200',
    low_stock: 'bg-amber-50 text-amber-700 border-amber-200',
    out_of_stock: 'bg-red-50 text-red-600 border-red-200',
    unknown: 'bg-[#1A1A1A]/5 text-[#1A1A1A]/50 border-[#1A1A1A]/10',
  };
  return (
    <span className={`font-sans text-[9px] font-bold uppercase tracking-widest border px-2.5 py-1 rounded-sm ${colours[status]}`}>
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookModal({ bookId, onClose, onAddToCart }: BookModalProps) {
  const { user } = useAuth();
  const { discountRate } = useUserProfile();
  const [book, setBook] = React.useState<BookDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Image viewer states
  const [activeTab, setActiveTab] = React.useState<'contents' | 'preview'>('contents');
  const [activePreviewIndex, setActivePreviewIndex] = React.useState<number>(0);
  const [activeViewportImageUrl, setActiveViewportImageUrl] = React.useState<string | null>(null);
  const [zoomScale, setZoomScale] = React.useState<boolean>(false);

  // Wishlist
  const [wishlisted, setWishlisted] = React.useState(false);
  const [wishlistLoading, setWishlistLoading] = React.useState(false);

  // Related books
  const [relatedBooks, setRelatedBooks] = React.useState<RelatedBook[]>([]);

  // Reviews
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [userReview, setUserReview] = React.useState<Review | null>(null);
  const [showReviews, setShowReviews] = React.useState(false);
  const [reviewRating, setReviewRating] = React.useState(0);
  const [reviewTitle, setReviewTitle] = React.useState('');
  const [reviewBody, setReviewBody] = React.useState('');
  const [reviewSubmitting, setReviewSubmitting] = React.useState(false);
  const [reviewError, setReviewError] = React.useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = React.useState(false);

  const getImageUrl = (source: any, width?: number, height?: number): string | null => {
    if (!source || !source.asset) return null;
    try {
      let b = urlFor(source);
      if (width) b = b.width(width);
      if (height) b = b.height(height);
      return b.url();
    } catch {
      return null;
    }
  };

  // ── Fetch book + related + wishlist + reviews ────────────────────────────
  React.useEffect(() => {
    if (!bookId) return;

    const fetchAll = async () => {
      setLoading(true);
      setActiveTab('contents');
      setActivePreviewIndex(0);
      setActiveViewportImageUrl(null);
      setReviews([]);
      setUserReview(null);
      setShowReviews(false);
      setReviewRating(0);
      setReviewTitle('');
      setReviewBody('');
      setReviewError(null);
      setReviewSuccess(false);

      try {
        const groqQuery = `*[_type == "book" && _id == $bookId][0]{
          ...,
          originalPrice,
          stock,
          publisher,
          "author": author->name,
          "categories": categories[]->{title, slug},
          "contentsImages": contentsImages[],
          "previewImages": previewImages[],
          year, binding, pages
        }`;
        const data: BookDetail | null = await client.fetch(groqQuery, { bookId });
        setBook(data);

        if (data) {
          addRecentlyViewedBook({
            _id: data._id,
            title: data.title,
            author: data.author,
            series: data.series,
            publisher: data.publisher,
            categories: data.categories,
          });

          // Cover image
          if (data.coverImage?.asset) {
            const url = getImageUrl(data.coverImage);
            if (url) setActiveViewportImageUrl(url);
          } else if (data.contentsImages) {
            const first = data.contentsImages.find((img: any) => img?.asset);
            if (first) {
              const url = getImageUrl(first);
              if (url) setActiveViewportImageUrl(url);
            }
          }

          // Related books: same author OR overlapping category, exclude self
          const catSlugs = (data.categories ?? []).map((c: any) => c?.slug?.current ?? c?.slug ?? '').filter(Boolean);
          const relatedQuery = `*[_type == "book" && _id != $bookId && (
            "author" == $author ||
            count(categories[]->slug.current[@ in $catSlugs]) > 0
          )][0...4]{
            _id, title,
            "author": author->name,
            price,
            coverImage
          }`;
          const related: RelatedBook[] = await client.fetch(relatedQuery, {
            bookId,
            author: data.author ?? '',
            catSlugs,
          }).catch(() => []);
          setRelatedBooks(related ?? []);

          // Wishlist status
          isWishlisted(user?.uid ?? null, data._id).then(v => setWishlisted(v)).catch(() => {});

          // Approved reviews
          getApprovedReviews(data._id).then(r => setReviews(r)).catch(() => {});

          // User's own review
          if (user?.uid) {
            getUserReview(data._id, user.uid).then(r => {
              if (r) {
                setUserReview(r);
                setReviewRating(r.rating);
                setReviewTitle(r.title ?? '');
                setReviewBody(r.body ?? '');
              }
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('BookModal fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [bookId, user?.uid]);

  // ── Wishlist toggle ──────────────────────────────────────────────────────
  const handleWishlistToggle = async () => {
    if (!book || wishlistLoading) return;
    setWishlistLoading(true);
    try {
      if (wishlisted) {
        await removeFromWishlist(user?.uid ?? null, book._id);
        setWishlisted(false);
      } else {
        await addToWishlist(user?.uid ?? null, book._id);
        setWishlisted(true);
      }
    } catch {
      /* silent — network error */
    } finally {
      setWishlistLoading(false);
    }
  };

  // ── Review submit ────────────────────────────────────────────────────────
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book || !user) return;
    if (reviewRating < 1) {
      setReviewError('Please select a rating before submitting.');
      return;
    }
    setReviewSubmitting(true);
    setReviewError(null);
    const result = await submitReview(book._id, user.uid, {
      rating: reviewRating,
      title: reviewTitle,
      body: reviewBody,
      userDisplayName: user.displayName ?? undefined,
    });
    setReviewSubmitting(false);
    if (result.ok) {
      setReviewSuccess(true);
      setUserReview({ bookId: book._id, userId: user.uid, rating: reviewRating, title: reviewTitle, body: reviewBody, status: 'pending' });
    } else {
      setReviewError(result.error);
    }
  };

  // ── Loading / empty guards ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/40 backdrop-blur-sm">
        <div className="bg-[#FBFBFA] border border-[#1A1A1A]/10 p-8 text-center max-w-sm shadow-xl">
          <p className="font-sans text-xs tracking-widest uppercase text-[#1A1A1A]/60 animate-pulse">
            Retrieving Book information....
          </p>
        </div>
      </div>
    );
  }

  if (!book) return null;

  const validContentsImages = (book.contentsImages || []).filter((img: any) => img?.asset);
  const validPreviewImages = (book.previewImages || []).filter((img: any) => img?.asset);
  const hasContents = validContentsImages.length > 0;
  const hasPreview = validPreviewImages.length > 0;
  const priced = customerPrice(book.price, book.originalPrice, discountRate);
  const onSale = priced.isDiscounted;
  const discount = priced.effectiveDiscountPercent;
  const canBuy = isPurchasable(book.stock);
  const { average, count } = averageRating(reviews);

  const coverImageUrl = book.coverImage?.asset ? getImageUrl(book.coverImage, 800) : null;
  const ldJson = jsonLdString(
    bookJsonLd({
      _id: book._id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      description: book.description,
      publisher: book.publisher,
      price: book.price,
      originalPrice: book.originalPrice,
      stock: book.stock,
      coverImageUrl,
    })
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#1A1A1A]/60 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`${book.title} — details`}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      tabIndex={-1}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson }} />
      {/* On mobile: full-screen sheet sliding up. On desktop: centered modal. */}
      <div className="bg-[#FBFBFA] border-t sm:border border-[#1A1A1A]/15 w-full max-w-5xl rounded-t-2xl sm:rounded-sm shadow-2xl flex flex-col md:flex-row h-[95vh] sm:h-auto sm:max-h-[90vh] overflow-hidden text-[#1A1A1A]">

        {/* ── Left: Image Viewport — hidden on mobile to save space ── */}
        <div className="hidden md:flex w-full md:w-3/5 bg-[#1A1A1A]/5 border-b md:border-b-0 md:border-r border-[#1A1A1A]/10 flex-col justify-between relative">

          <div className="flex items-center gap-2 p-4 bg-[#FBFBFA]/50 border-b border-[#1A1A1A]/5 backdrop-blur-sm z-10 font-sans text-[10px] tracking-wider uppercase font-bold text-[#1A1A1A]/60">
            <button
              onClick={() => setActiveTab('contents')}
              className={`px-3 py-1.5 transition-colors border ${activeTab === 'contents' ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'border-transparent hover:text-[#1A1A1A]'}`}
            >
              Showcase & Contents ({(book.coverImage?.asset ? 1 : 0) + validContentsImages.length})
            </button>
            {hasPreview && (
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 transition-colors border ${activeTab === 'preview' ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'border-transparent hover:text-[#1A1A1A]'}`}
              >
                Peek Inside ({validPreviewImages.length})
              </button>
            )}
          </div>

          <div className="flex-grow flex items-center justify-center p-6 overflow-hidden relative">

            {activeTab === 'contents' && (
              <div className="w-full h-full flex flex-row gap-4 items-stretch overflow-hidden">
                <div className="w-20 border-r border-[#1A1A1A]/10 pr-2 overflow-y-auto flex flex-col gap-2 h-full max-h-[350px] md:max-h-[500px]">
                  {book.coverImage?.asset && (
                    <button
                      onClick={() => { const u = getImageUrl(book.coverImage); if (u) setActiveViewportImageUrl(u); }}
                      className={`border rounded-sm overflow-hidden aspect-[3/4] flex-shrink-0 transition-all ${activeViewportImageUrl === getImageUrl(book.coverImage) ? 'border-[#7D5A34] ring-2 ring-[#7D5A34]/20' : 'border-[#1A1A1A]/10 opacity-75 hover:opacity-100'}`}
                    >
                      <img src={getImageUrl(book.coverImage, 120) || ''} alt="Cover Miniature" className="w-full h-full object-cover" />
                    </button>
                  )}
                  {hasContents && validContentsImages.map((img: any, idx: number) => {
                    const imgUrl = getImageUrl(img);
                    const thumbUrl = getImageUrl(img, 120);
                    if (!imgUrl || !thumbUrl) return null;
                    return (
                      <button
                        key={`mini-${idx}`}
                        onClick={() => setActiveViewportImageUrl(imgUrl)}
                        className={`border rounded-sm overflow-hidden aspect-[3/4] flex-shrink-0 transition-all ${activeViewportImageUrl === imgUrl ? 'border-[#7D5A34] ring-2 ring-[#7D5A34]/20' : 'border-[#1A1A1A]/10 opacity-75 hover:opacity-100'}`}
                      >
                        <img src={thumbUrl} alt={`Content Leaf ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
                <div className="flex-grow flex items-center justify-center relative bg-white border border-[#1A1A1A]/10 p-2 overflow-hidden h-full">
                  {activeViewportImageUrl ? (
                    <img src={activeViewportImageUrl} alt="Active Plate" className="max-h-full max-w-full object-contain shadow-sm" />
                  ) : (
                    <span className="font-serif text-5xl opacity-20 font-bold">{book.coverPlaceholder || 'IAD'}</span>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'preview' && hasPreview && (
              <div className="w-full h-full flex flex-col justify-between items-center relative">
                <div className="flex-grow flex items-center justify-center max-h-[70%] w-full relative">
                  <img
                    src={getImageUrl(validPreviewImages[activePreviewIndex], undefined, 600) || ''}
                    alt={`Preview Page ${activePreviewIndex + 1}`}
                    onClick={() => setZoomScale(p => !p)}
                    className={`max-h-full object-contain cursor-zoom-in transition-transform duration-200 select-none ${zoomScale ? 'scale-150 z-20 shadow-2xl' : ''}`}
                  />
                  {zoomScale && (
                    <div className="absolute bottom-2 bg-[#1A1A1A] text-[#FBFBFA] text-[9px] uppercase tracking-widest px-2 py-1 pointer-events-none">
                      Click image to Zoom Out
                    </div>
                  )}
                </div>
                <div className="w-full flex items-center justify-between px-6 pt-4 border-t border-[#1A1A1A]/5">
                  <button disabled={activePreviewIndex === 0} onClick={() => { setActivePreviewIndex(p => p - 1); setZoomScale(false); }} className="p-2 border border-[#1A1A1A]/10 hover:border-[#1A1A1A] text-xs font-bold font-sans tracking-widest uppercase disabled:opacity-30 disabled:pointer-events-none transition-all">← Prev</button>
                  <span className="font-sans text-[11px] font-semibold text-[#1A1A1A]/60">{activePreviewIndex + 1} of {validPreviewImages.length} Pages</span>
                  <button disabled={activePreviewIndex === validPreviewImages.length - 1} onClick={() => { setActivePreviewIndex(p => p + 1); setZoomScale(false); }} className="p-2 border border-[#1A1A1A]/10 hover:border-[#1A1A1A] text-xs font-bold font-sans tracking-widest uppercase disabled:opacity-30 disabled:pointer-events-none transition-all">Next →</button>
                </div>
              </div>
            )}
          </div>

          
        </div>

        {/* ── Right: Metadata, Pricing, Reviews, Related ── */}
        <div className="w-full md:w-2/5 flex flex-col overflow-y-auto bg-[#FBFBFA]">

          {/* Mobile-only cover image + drag indicator */}
          <div className="md:hidden flex flex-col items-center pt-3 pb-2 flex-shrink-0">
            <div className="w-10 h-1 bg-[#1A1A1A]/20 rounded-full mb-3" />
            {book.coverImage?.asset && (
              <img
                src={getImageUrl(book.coverImage, 120) || ''}
                alt={book.title}
                className="h-28 w-auto object-contain rounded-sm shadow-md"
              />
            )}
          </div>

          {/* Scrollable content area */}
          <div className="flex-grow px-5 py-4 md:p-8 overflow-y-auto">

            {/* Title + Wishlist */}
            <div className="flex justify-between items-start border-b border-[#1A1A1A]/10 pb-4 mb-6">
              <div className="flex-grow pr-4">
                {book.series && (
                  <span className="font-sans text-[10px] uppercase tracking-widest text-[#7D5A34] font-bold mb-1.5 block">{book.series}</span>
                )}
                <h3 className="text-2xl font-normal leading-snug tracking-tight font-serif text-[#1A1A1A]">{book.title}</h3>
                <p className="font-sans text-xs text-[#1A1A1A]/70 mt-1">
                  By <span className="font-semibold text-[#1A1A1A]">{book.author}</span>
                </p>

                {/* Average rating display */}
                {count > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <StarRating value={Math.round(average)} />
                    <span className="font-sans text-[10px] text-[#1A1A1A]/50">{average.toFixed(1)} ({count} review{count !== 1 ? 's' : ''})</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Wishlist heart */}
                <button
                  onClick={handleWishlistToggle}
                  disabled={wishlistLoading}
                  aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  aria-pressed={wishlisted}
                  title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  className={`text-xl transition-all p-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7D5A34] ${wishlistLoading ? 'opacity-40' : ''} ${wishlisted ? 'text-red-500 hover:text-red-400' : 'text-[#1A1A1A]/30 hover:text-red-400'}`}
                >
                  {wishlisted ? '♥' : '♡'}
                </button>

                {/* Close */}
                <button onClick={onClose} aria-label="Close book details" className="text-xl leading-none text-[#1A1A1A]/40 hover:text-[#1A1A1A] font-light border border-transparent hover:border-[#1A1A1A]/10 p-1.5 rounded transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7D5A34]">✕</button>
              </div>
            </div>

            {/* Categories */}
            {book.categories && book.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {book.categories.map((cat, idx) => (
                  <span key={idx} className="font-sans text-[9px] uppercase tracking-wider bg-[#1A1A1A]/5 border border-[#1A1A1A]/5 text-[#1A1A1A]/70 px-2.5 py-1 rounded-sm">{cat.title}</span>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="text-xs font-sans leading-relaxed text-[#1A1A1A]/80 border-b border-[#1A1A1A]/5 pb-6 mb-6">
              <h4 className="font-sans text-[10px] tracking-widest uppercase font-bold text-[#1A1A1A]/40 mb-2">Abstract</h4>
              {book.description ? (
                <p>{book.description}</p>
              ) : (
                <p className="italic text-[#1A1A1A]/50">This critical text represents a classic manuscript within the comprehensive catalog collections of the Idarah-i Adabiyat-i Dilli archive, fully associated with Jayyad Press editorial outputs.</p>
              )}
            </div>

            {/* Specs grid */}
            <div className="grid grid-cols-2 gap-4 bg-[#1A1A1A]/[0.02] border border-[#1A1A1A]/5 p-4 mb-6">
              {book.year && (
                <div>
                  <span className="font-sans text-[8px] uppercase tracking-widest text-[#1A1A1A]/40 block mb-0.5">Release Year</span>
                  <span className="font-sans text-[11px] font-bold text-[#1A1A1A]">{book.year}</span>
                </div>
              )}
              {book.binding && (
                <div>
                  <span className="font-sans text-[8px] uppercase tracking-widest text-[#1A1A1A]/40 block mb-0.5">Format / Binding</span>
                  <span className="font-sans text-[11px] font-bold text-[#1A1A1A]">{book.binding}</span>
                </div>
              )}
              {book.pages && (
                <div>
                  <span className="font-sans text-[8px] uppercase tracking-widest text-[#1A1A1A]/40 block mb-0.5">Pages</span>
                  <span className="font-sans text-[11px] font-bold text-[#1A1A1A]">{book.pages}</span>
                </div>
              )}
              <div>
                <span className="font-sans text-[8px] uppercase tracking-widest text-[#1A1A1A]/40 block mb-0.5">Table of Contents</span>
                <span className="font-sans text-[11px] font-bold text-[#1A1A1A]">{hasContents ? `${validContentsImages.length} Pages Available` : 'Legacy Standard Print'}</span>
              </div>
              <div>
                <span className="font-sans text-[8px] uppercase tracking-widest text-[#1A1A1A]/40 block mb-0.5">ISBN</span>
                <span className="font-mono text-[10px] font-bold text-[#1A1A1A]">{book.isbn || 'N/A (Historical)'}</span>
              </div>
            </div>

            {/* ── Reviews section ── */}
            <div className="border-t border-[#1A1A1A]/5 pt-6 mb-6">
              <button
                onClick={() => setShowReviews(p => !p)}
                className="flex items-center justify-between w-full font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/50 hover:text-[#1A1A1A] transition-colors mb-3"
              >
                <span>Reader Reviews {count > 0 ? `(${count})` : ''}</span>
                <span>{showReviews ? '▲' : '▼'}</span>
              </button>

              {showReviews && (
                <div className="space-y-4">
                  {/* Leave / edit a review — only for logged-in users */}
                  {user ? (
                    <form onSubmit={handleReviewSubmit} className="bg-[#1A1A1A]/[0.02] border border-[#1A1A1A]/5 p-4 rounded-sm space-y-3">
                      <h5 className="font-sans text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40">
                        {userReview ? 'Edit Your Review' : 'Write a Review'}
                      </h5>
                      <StarRating value={reviewRating} onSelect={v => { setReviewRating(v); setReviewError(null); }} />
                      <input
                        type="text"
                        placeholder="Title (optional)"
                        value={reviewTitle}
                        onChange={e => setReviewTitle(e.target.value)}
                        maxLength={100}
                        className="w-full bg-white border border-[#1A1A1A]/10 text-xs p-2 outline-none font-sans"
                      />
                      <textarea
                        placeholder="Share your thoughts… (optional)"
                        value={reviewBody}
                        onChange={e => setReviewBody(e.target.value)}
                        maxLength={2000}
                        rows={3}
                        className="w-full bg-white border border-[#1A1A1A]/10 text-xs p-2 outline-none resize-none font-sans"
                      />
                      {reviewError && <p className="text-[10px] text-red-600 font-sans">{reviewError}</p>}
                      {reviewSuccess ? (
                        <p className="text-[10px] text-[#7D5A34] font-sans font-semibold">Thank you! Your review is pending approval.</p>
                      ) : (
                        <button
                          type="submit"
                          disabled={reviewSubmitting}
                          className="font-sans text-[10px] font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-4 py-2 hover:bg-[#7D5A34] transition-colors disabled:opacity-40"
                        >
                          {reviewSubmitting ? 'Submitting…' : userReview ? 'Update Review' : 'Submit Review'}
                        </button>
                      )}
                    </form>
                  ) : (
                    <p className="font-sans text-[10px] text-[#1A1A1A]/50 italic">Sign in to leave a review.</p>
                  )}

                  {/* Approved reviews list */}
                  {reviews.length > 0 ? reviews.map((r, idx) => (
                    <div key={`${r.userId}-${idx}`} className="border-b border-[#1A1A1A]/5 pb-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <StarRating value={r.rating} />
                          {r.title && <span className="font-sans text-[11px] font-bold text-[#1A1A1A]">{r.title}</span>}
                        </div>
                        <span className="font-sans text-[9px] text-[#1A1A1A]/40">
                          {r.userDisplayName || 'Reader'}
                        </span>
                      </div>
                      {r.body && <p className="font-sans text-[11px] text-[#1A1A1A]/70 leading-relaxed">{r.body}</p>}
                    </div>
                  )) : (
                    <p className="font-sans text-[10px] text-[#1A1A1A]/40 italic">No approved reviews yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Related Books ── */}
            {relatedBooks.length > 0 && (
              <div className="border-t border-[#1A1A1A]/5 pt-6">
                <h4 className="font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 mb-3">You May Also Like</h4>
                <div className="grid grid-cols-2 gap-3">
                  {relatedBooks.map(rb => {
                    const coverUrl = rb.coverImage?.asset ? (() => { try { return urlFor(rb.coverImage).width(160).url(); } catch { return null; } })() : null;
                    return (
                      <button
                        key={rb._id}
                        onClick={() => {
                          // Close this modal and open the related one via a custom event
                          // (parent pages listen for this pattern through onClose + selectedBookId)
                          onClose();
                          setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('openBookModal', { detail: { bookId: rb._id } }));
                          }, 150);
                        }}
                        className="text-left border border-[#1A1A1A]/5 p-2 bg-white hover:shadow-sm transition-all group"
                      >
                        <div className="aspect-[3/4] bg-[#1A1A1A]/5 mb-2 overflow-hidden flex items-center justify-center">
                          {coverUrl ? (
                            <img src={coverUrl} alt={rb.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <span className="text-2xl opacity-20 font-bold">IAD</span>
                          )}
                        </div>
                        <p className="font-serif text-[11px] font-bold leading-snug line-clamp-2 text-[#1A1A1A] group-hover:text-[#7D5A34] transition-colors">{rb.title}</p>
                        <p className="font-sans text-[9px] text-[#1A1A1A]/50 mt-0.5 truncate">{rb.author ?? ''}</p>
                        <p className="font-sans text-[11px] font-bold mt-1">₹{rb.price}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Sticky bottom: Price + Stock + CTA ── */}
          <div className="border-t border-[#1A1A1A]/10 px-5 py-4 md:p-6 bg-[#FBFBFA] flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="font-sans text-[9px] tracking-widest uppercase text-[#1A1A1A]/40 block">Price</span>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-serif text-2xl font-bold text-[#1A1A1A]">₹{priced.finalPrice}</span>
                  {onSale && priced.originalPrice != null && <span className="font-sans text-xs text-[#1A1A1A]/50 line-through">₹{priced.originalPrice}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StockPill stock={book.stock} />
                {onSale && (
                  <span className="font-sans text-[10px] uppercase tracking-widest text-white bg-[#7D5A34] px-2.5 py-1 font-bold">{discount}% OFF</span>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  onAddToCart(book._id);
                  onClose();
                }}
                disabled={!canBuy}
                className="flex-grow font-sans text-xs font-bold uppercase tracking-widest bg-[#1A1A1A] hover:bg-[#7D5A34] text-white py-4 text-center transition-colors border border-[#1A1A1A] hover:border-[#7D5A34] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1A1A1A] disabled:hover:border-[#1A1A1A]"
              >
                {canBuy ? 'Add to Cart' : 'Out of Stock'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
