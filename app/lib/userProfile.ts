// User profile — Firestore document at users/{uid}.
// Source of truth for account type, verification status, and personal discount rate.

import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

export type AccountType =
  | 'regular'
  | 'student'
  | 'author'
  | 'trade_partner'
  | 'library'
  | 'institution';

export type VerificationStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

export interface AccountTypeMeta {
  value: AccountType;
  label: string;
  requiresVerification: boolean;
  description: string;
  /** Default discount % (0–100) pre-filled on the verification page. Admin can override per user. */
  defaultDiscount: number;
}

export const ACCOUNT_TYPES: AccountTypeMeta[] = [
  { value: 'regular',       label: 'Regular Customer',               requiresVerification: false, defaultDiscount: 0,  description: 'Standard retail account.' },
  { value: 'student',       label: 'Student',                        requiresVerification: true,  defaultDiscount: 10, description: 'Requires student ID verification.' },
  { value: 'author',        label: 'Author',                         requiresVerification: true,  defaultDiscount: 15, description: 'For published authors — verification required.' },
  { value: 'trade_partner', label: 'Bookseller / Publisher / Distributor', requiresVerification: true, defaultDiscount: 30, description: 'Trade account — settle the exact rate per partner on approval.' },
  { value: 'library',       label: 'Library',                        requiresVerification: true,  defaultDiscount: 15, description: 'For institutional libraries.' },
  { value: 'institution',   label: 'Educational Institution',        requiresVerification: true,  defaultDiscount: 15, description: 'Colleges, universities, schools.' },
];

/**
 * Legacy type values folded into `trade_partner` by the 2026-09 rename.
 * Keep in sync with any type you retire in the future.
 */
export const LEGACY_TRADE_TYPES = ['distributor', 'publication_house'] as const;

/** Map a stored value (possibly legacy) to its canonical type. */
export function canonicalAccountType(value: unknown): AccountType {
  if (value === 'distributor' || value === 'publication_house') return 'trade_partner';
  const known = ACCOUNT_TYPES.find(a => a.value === value);
  return known ? known.value : 'regular';
}

/** Default discount % for a type (legacy values resolve to their canonical type). */
export function defaultDiscountFor(value: unknown): number {
  const meta = ACCOUNT_TYPES.find(a => a.value === canonicalAccountType(value));
  return meta?.defaultDiscount ?? 0;
}

export interface UserProfile {
  uid: string;
  name?: string;
  email?: string;
  phone?: string;
  accountType: AccountType;
  verificationStatus: VerificationStatus;
  /** 0–100. Applied to base Sanity price. */
  discountRate: number;
  createdAt?: number;
  updatedAt?: number;
  approvedAt?: number;
  approvedBy?: string;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    return {
      uid,
      name: data.name,
      email: data.email,
      phone: data.phone,
      accountType: canonicalAccountType(data.accountType),
      verificationStatus: data.verificationStatus ?? 'not_required',
      discountRate: Number.isFinite(Number(data.discountRate)) ? Number(data.discountRate) : 0,
      createdAt: data.createdAt?.toMillis?.(),
      updatedAt: data.updatedAt?.toMillis?.(),
      approvedAt: data.approvedAt?.toMillis?.(),
      approvedBy: data.approvedBy,
    };
  } catch (err) {
    console.warn('Failed to load user profile:', err);
    return null;
  }
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Called during signup. Creates the user's Firestore profile with defaults.
 * `regular` accounts are auto-approved (not_required). Others start `pending`.
 */
export async function createUserProfile(input: {
  uid: string;
  name?: string;
  email?: string;
  phone?: string;
  accountType?: AccountType;
}): Promise<void> {
  const { uid, name, email, phone } = input;
  const accountType: AccountType = canonicalAccountType(input.accountType ?? 'regular');
  const meta = ACCOUNT_TYPES.find(a => a.value === accountType);
  const verificationStatus: VerificationStatus = meta?.requiresVerification ? 'pending' : 'not_required';

  await setDoc(doc(db, 'users', uid), {
    uid,
    name: name ?? '',
    email: email ?? '',
    phone: phone ?? '',
    accountType,
    verificationStatus,
    discountRate: 0,   // starts at 0 regardless of tier; admin sets it after approval
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/** User updates their own name/phone. */
export async function updateOwnProfile(uid: string, updates: Partial<Pick<UserProfile, 'name' | 'phone'>>): Promise<void> {
  if (!uid) return;
  await updateDoc(doc(db, 'users', uid), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// ─── Admin operations ─────────────────────────────────────────────────────────

export async function adminSetVerification(
  uid: string,
  status: 'approved' | 'rejected',
  approvedByUid: string,
  discountRate?: number
): Promise<void> {
  const payload: any = {
    verificationStatus: status,
    updatedAt: serverTimestamp(),
    approvedAt: status === 'approved' ? serverTimestamp() : null,
    approvedBy: approvedByUid,
  };
  if (typeof discountRate === 'number' && Number.isFinite(discountRate)) {
    payload.discountRate = Math.max(0, Math.min(100, discountRate));
  }
  await updateDoc(doc(db, 'users', uid), payload);
}

export async function adminSetAccountType(uid: string, accountType: AccountType, approvedByUid?: string): Promise<void> {
  const canonical = canonicalAccountType(accountType);
  const meta = ACCOUNT_TYPES.find(a => a.value === canonical);
  const payload: any = { accountType: canonical, updatedAt: serverTimestamp() };
  // Re-derive verification status from the new type so the two fields never contradict:
  // non-verified types → not_required, verified types → back to pending for review.
  if (meta) {
    payload.verificationStatus = meta.requiresVerification ? 'pending' : 'not_required';
    if (!meta.requiresVerification) {
      payload.approvedAt = null;
      payload.approvedBy = approvedByUid ?? null;
    }
  }
  await updateDoc(doc(db, 'users', uid), payload);
}

/**
 * Change a user's type AND set their discount in one write.
 * If `discountRate` is omitted, it resets to the new type's default so a
 * stale rate from the old type never carries over silently.
 */
export async function adminReassignAccount(
  uid: string,
  accountType: AccountType,
  approvedByUid: string,
  discountRate?: number
): Promise<void> {
  await adminSetAccountType(uid, accountType, approvedByUid);
  const rate = typeof discountRate === 'number' && Number.isFinite(discountRate)
    ? discountRate
    : defaultDiscountFor(accountType);
  await adminSetDiscountRate(uid, rate);
}

export async function adminSetDiscountRate(uid: string, discountRate: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Number(discountRate) || 0));
  await updateDoc(doc(db, 'users', uid), { discountRate: clamped, updatedAt: serverTimestamp() });
}

export async function listPendingVerifications(): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users'), where('verificationStatus', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as any;
      return {
        uid: d.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        accountType: canonicalAccountType(data.accountType),
        verificationStatus: data.verificationStatus,
        discountRate: Number(data.discountRate) || 0,
        createdAt: data.createdAt?.toMillis?.(),
      };
    });
  } catch (err) {
    console.warn('Failed to list pending verifications:', err);
    return [];
  }
}
