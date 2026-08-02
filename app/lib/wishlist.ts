// Wishlist: Firestore-backed for logged-in users, localStorage for anon.
// On login, any local wishlist entries are merged into Firestore so nothing is lost.

import { db } from './firebase';
import { doc, setDoc, deleteDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';

const LOCAL_KEY = 'iad_wishlist';

export interface WishlistEntry {
  bookId: string;
  addedAt?: number;
}

// ─── localStorage (anonymous users) ───────────────────────────────────────────

function readLocal(): WishlistEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is WishlistEntry => !!e && typeof e.bookId === 'string');
  } catch {
    return [];
  }
}

function writeLocal(entries: WishlistEntry[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event('wishlistUpdate'));
  } catch {
    /* ignore */
  }
}

function clearLocal(): void {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

// ─── Firestore (logged-in users) ──────────────────────────────────────────────

function userWishlistCol(uid: string) {
  return collection(db, 'users', uid, 'wishlist');
}

async function readFirestore(uid: string): Promise<WishlistEntry[]> {
  const snap = await getDocs(userWishlistCol(uid));
  return snap.docs.map(d => ({
    bookId: d.id,
    addedAt: d.data()?.addedAt?.toMillis?.() ?? undefined,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Read the current wishlist. Pass the logged-in user's uid, or null for anon. */
export async function getWishlist(uid: string | null): Promise<WishlistEntry[]> {
  if (uid) {
    try {
      return await readFirestore(uid);
    } catch (err) {
      console.warn('Firestore wishlist read failed, falling back to localStorage:', err);
      return readLocal();
    }
  }
  return readLocal();
}

export async function addToWishlist(uid: string | null, bookId: string): Promise<void> {
  if (!bookId) return;
  if (uid) {
    try {
      await setDoc(doc(userWishlistCol(uid), bookId), { addedAt: serverTimestamp() });
      window.dispatchEvent(new Event('wishlistUpdate'));
      return;
    } catch (err) {
      console.warn('Firestore wishlist write failed, falling back to localStorage:', err);
    }
  }
  const entries = readLocal().filter(e => e.bookId !== bookId);
  entries.unshift({ bookId, addedAt: Date.now() });
  writeLocal(entries);
}

export async function removeFromWishlist(uid: string | null, bookId: string): Promise<void> {
  if (!bookId) return;
  if (uid) {
    try {
      await deleteDoc(doc(userWishlistCol(uid), bookId));
      window.dispatchEvent(new Event('wishlistUpdate'));
      return;
    } catch (err) {
      console.warn('Firestore wishlist delete failed, falling back to localStorage:', err);
    }
  }
  writeLocal(readLocal().filter(e => e.bookId !== bookId));
}

export async function isWishlisted(uid: string | null, bookId: string): Promise<boolean> {
  const entries = await getWishlist(uid);
  return entries.some(e => e.bookId === bookId);
}

/**
 * Called after a successful login. Merges any anonymous localStorage entries
 * into the user's Firestore wishlist, then clears local storage.
 */
export async function mergeLocalWishlistIntoFirestore(uid: string): Promise<void> {
  const local = readLocal();
  if (local.length === 0) return;
  try {
    await Promise.all(
      local.map(entry =>
        setDoc(doc(userWishlistCol(uid), entry.bookId), { addedAt: serverTimestamp() })
      )
    );
    clearLocal();
    window.dispatchEvent(new Event('wishlistUpdate'));
  } catch (err) {
    console.warn('Wishlist merge to Firestore failed:', err);
  }
}
