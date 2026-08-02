// Reviews: stored in Firestore under reviews/{bookId}/entries/{userId}.
// One review per user per book (userId is the doc ID). Reviews start as `pending`
// and only `approved` reviews are returned to public callers.

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  where,
  Timestamp,
} from 'firebase/firestore';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  bookId: string;
  userId: string;
  userDisplayName?: string;
  rating: number;      // 1-5
  title?: string;
  body?: string;
  status: ReviewStatus;
  createdAt?: number;  // epoch ms
  updatedAt?: number;
}

export interface ReviewInput {
  rating: number;
  title?: string;
  body?: string;
  userDisplayName?: string;
}

function entriesCol(bookId: string) {
  return collection(db, 'reviews', bookId, 'entries');
}

function docToReview(d: any, fallbackBookId?: string): Review {
  const data = d.data() ?? {};
  return {
    bookId: data.bookId ?? fallbackBookId ?? '',
    userId: d.id,
    userDisplayName: typeof data.userDisplayName === 'string' ? data.userDisplayName : undefined,
    rating: Number.isFinite(Number(data.rating)) ? Math.max(1, Math.min(5, Number(data.rating))) : 0,
    title: typeof data.title === 'string' ? data.title : undefined,
    body: typeof data.body === 'string' ? data.body : undefined,
    status: (data.status === 'approved' || data.status === 'rejected') ? data.status : 'pending',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : undefined,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : undefined,
  };
}

/** Return approved reviews for a book, newest first. Safe to call for any user. */
export async function getApprovedReviews(bookId: string): Promise<Review[]> {
  if (!bookId) return [];
  try {
    const q = query(entriesCol(bookId), where('status', '==', 'approved'));
    const snap = await getDocs(q);
    const reviews = snap.docs.map(d => docToReview(d, bookId));
    reviews.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return reviews;
  } catch (err) {
    console.warn('Failed to fetch reviews:', err);
    return [];
  }
}

/** Load the current user's review for a book (any status), or null. */
export async function getUserReview(bookId: string, userId: string): Promise<Review | null> {
  if (!bookId || !userId) return null;
  try {
    const snap = await getDoc(doc(entriesCol(bookId), userId));
    return snap.exists() ? docToReview(snap, bookId) : null;
  } catch (err) {
    console.warn('Failed to fetch user review:', err);
    return null;
  }
}

/**
 * Create or update the caller's review for a book. Rating is coerced into 1-5.
 * Newly submitted reviews are stored with status="pending" and require admin approval.
 */
export async function submitReview(
  bookId: string,
  userId: string,
  input: ReviewInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!bookId) return { ok: false, error: 'bookId is required.' };
  if (!userId) return { ok: false, error: 'You must be signed in to leave a review.' };

  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'Rating must be between 1 and 5.' };
  }

  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 100) : '';
  const body = typeof input.body === 'string' ? input.body.trim().slice(0, 2000) : '';
  const displayName = typeof input.userDisplayName === 'string' ? input.userDisplayName.trim().slice(0, 60) : '';

  try {
    const ref = doc(entriesCol(bookId), userId);
    const existing = await getDoc(ref);
    await setDoc(
      ref,
      {
        bookId,
        userId,
        userDisplayName: displayName || null,
        rating,
        title: title || null,
        body: body || null,
        status: 'pending',
        createdAt: existing.exists() ? existing.data()?.createdAt ?? serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { ok: true };
  } catch (err: any) {
    console.warn('Failed to submit review:', err);
    return { ok: false, error: err?.message || 'Could not save your review right now.' };
  }
}

/** Average rating + count from an array of approved reviews. */
export function averageRating(reviews: Review[]): { average: number; count: number } {
  if (!reviews.length) return { average: 0, count: 0 };
  const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
  return { average: sum / reviews.length, count: reviews.length };
}
