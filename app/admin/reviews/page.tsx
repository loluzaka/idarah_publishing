"use client";

import React, { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { client } from '@/app/sanityClient';
import { collectionGroup, getDocs, query, where, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { MessageSquare, Check, X } from 'lucide-react';

interface PendingReview {
  bookId: string;
  userId: string;
  userDisplayName?: string;
  rating: number;
  title?: string;
  body?: string;
  status: string;
  createdAt?: number;
  bookTitle?: string;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collectionGroup(db, 'entries'), where('status', '==', filter));
      const snap = await getDocs(q);
      const raw: PendingReview[] = snap.docs.map(d => {
        const data = d.data() as any;
        const ts = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : undefined;
        return {
          bookId: data.bookId ?? d.ref.parent.parent?.id ?? '',
          userId: d.id,
          userDisplayName: data.userDisplayName ?? undefined,
          rating: Number(data.rating) || 0,
          title: data.title ?? undefined,
          body: data.body ?? undefined,
          status: data.status,
          createdAt: ts,
        };
      });

      // Enrich with book title
      const bookIds = [...new Set(raw.map(r => r.bookId).filter(Boolean))];
      if (bookIds.length > 0) {
        const books = await client.fetch(`*[_type == "book" && _id in $ids]{ _id, title }`, { ids: bookIds });
        const map = new Map(books.map((b: any) => [b._id, b.title]));
        raw.forEach(r => { r.bookTitle = map.get(r.bookId) as string | undefined; });
      }

      raw.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setReviews(raw);
    } catch (err) {
      console.error('Failed to load reviews (Firestore may need composite index):', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (r: PendingReview, status: 'approved' | 'rejected') => {
    if (!r.bookId || !r.userId) return;
    setBusyId(`${r.bookId}-${r.userId}`);
    try {
      await updateDoc(doc(db, 'reviews', r.bookId, 'entries', r.userId), { status });
      setReviews(prev => prev.filter(x => !(x.bookId === r.bookId && x.userId === r.userId)));
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: PendingReview) => {
    if (!confirm('Delete this review permanently?')) return;
    setBusyId(`${r.bookId}-${r.userId}`);
    try {
      await deleteDoc(doc(db, 'reviews', r.bookId, 'entries', r.userId));
      setReviews(prev => prev.filter(x => !(x.bookId === r.bookId && x.userId === r.userId)));
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#1A1A1A]/10">
        <MessageSquare className="w-6 h-6 text-[#7D5A34]" strokeWidth={1.5} />
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#7D5A34] font-bold block">Moderation</span>
          <h1 className="font-serif text-3xl font-normal">Reviews</h1>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] uppercase tracking-widest font-bold px-3 py-2 rounded-sm transition-colors ${filter === f ? 'bg-[#1A1A1A] text-white' : 'bg-white border border-[#1A1A1A]/10 text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs italic text-[#1A1A1A]/40 animate-pulse">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <div className="border border-dashed border-[#1A1A1A]/10 bg-white p-12 text-center rounded-sm">
          <p className="text-xs italic text-[#1A1A1A]/50">No {filter} reviews.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => {
            const busy = busyId === `${r.bookId}-${r.userId}`;
            return (
              <div key={`${r.bookId}-${r.userId}`} className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <div>
                    <p className="font-serif text-sm font-bold">{r.bookTitle ?? r.bookId}</p>
                    <p className="text-[10px] text-[#1A1A1A]/50 mt-0.5">
                      By {r.userDisplayName ?? 'Anonymous'} · {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} className={s <= r.rating ? 'text-[#7D5A34]' : 'text-[#1A1A1A]/15'}>★</span>
                    ))}
                  </div>
                </div>
                {r.title && <p className="text-sm font-bold mt-2">{r.title}</p>}
                {r.body && <p className="text-xs text-[#1A1A1A]/70 mt-1 leading-relaxed">{r.body}</p>}

                {filter === 'pending' && (
                  <div className="flex gap-2 mt-4 pt-3 border-t border-[#1A1A1A]/5">
                    <button
                      onClick={() => updateStatus(r, 'approved')}
                      disabled={busy}
                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-green-600 text-white px-3 py-1.5 hover:bg-green-700 transition-colors disabled:opacity-40"
                    >
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button
                      onClick={() => updateStatus(r, 'rejected')}
                      disabled={busy}
                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest border border-[#1A1A1A]/20 text-[#1A1A1A] px-3 py-1.5 hover:bg-[#1A1A1A]/5 transition-colors disabled:opacity-40"
                    >
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
                {filter !== 'pending' && (
                  <button
                    onClick={() => remove(r)}
                    disabled={busy}
                    className="mt-3 text-[10px] text-red-500 hover:underline"
                  >
                    Delete permanently
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
