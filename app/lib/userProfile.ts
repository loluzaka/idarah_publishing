// User profile — Firestore document at users/{uid}.
// Source of truth for account type, verification status, and personal discount rate.

import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

export type AccountType =
  | 'regular'
  | 'student'
  | 'author'
  | 'publication_house'
  | 'distributor'
  | 'library'
  | 'institution';

export type VerificationStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

export interface AccountTypeMeta {
  value: AccountType;
  label: string;
  requiresVerification: boolean;
  description: string;
}

export const ACCOUNT_TYPES: AccountTypeMeta[] = [
  { value: 'regular',           label: 'Regular Customer',    requiresVerification: false, description: 'Standard retail account.' },
  { value: 'student',           label: 'Student',             requiresVerification: true,  description: 'Requires student ID verification.' },
  { value: 'author',            label: 'Author',              requiresVerification: true,  description: 'For published authors — verification required.' },
  { value: 'publication_house', label: 'Publication House',   requiresVerification: true,  description: 'Trade account for publishers.' },
  { value: 'distributor',       label: 'Distributor',         requiresVerification: true,  description: 'Wholesale distributor account.' },
  { value: 'library',           label: 'Library',             requiresVerification: true,  description: 'For institutional libraries.' },
  { value: 'institution',       label: 'Educational Institution', requiresVerification: true, description: 'Colleges, universities, schools.' },
];

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
      accountType: data.accountType ?? 'regular',
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
  const accountType: AccountType = input.accountType ?? 'regular';
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

export async function adminSetAccountType(uid: string, accountType: AccountType): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { accountType, updatedAt: serverTimestamp() });
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
        accountType: data.accountType ?? 'regular',
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
