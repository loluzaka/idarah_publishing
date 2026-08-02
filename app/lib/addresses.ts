// Address book — Firestore under users/{uid}/addresses/{addressId}.

import { db } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export interface Address {
  id?: string;
  label?: string;        // "Home", "Office", etc.
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

function addressesCol(uid: string) {
  return collection(db, 'users', uid, 'addresses');
}

export async function getAddresses(uid: string): Promise<Address[]> {
  if (!uid) return [];
  try {
    const snap = await getDocs(addressesCol(uid));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Address) }));
  } catch (err) {
    console.warn('Failed to load addresses:', err);
    return [];
  }
}

export async function saveAddress(uid: string, address: Address): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!uid) return { ok: false, error: 'You must be signed in.' };
  if (!address.addressLine1?.trim() || !address.city?.trim() || !address.postalCode?.trim()) {
    return { ok: false, error: 'Address line, city, and postal code are required.' };
  }
  try {
    const id = address.id || `addr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ref = doc(addressesCol(uid), id);
    const payload = {
      label: address.label?.trim() || 'Address',
      fullName: address.fullName?.trim() || '',
      phone: address.phone?.trim() || '',
      addressLine1: address.addressLine1.trim(),
      addressLine2: address.addressLine2?.trim() || '',
      city: address.city.trim(),
      state: address.state?.trim() || '',
      postalCode: address.postalCode.trim(),
      country: address.country?.trim() || 'India',
      isDefault: !!address.isDefault,
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload, { merge: true });
    return { ok: true, id };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not save address.' };
  }
}

export async function deleteAddress(uid: string, id: string): Promise<void> {
  if (!uid || !id) return;
  try {
    await deleteDoc(doc(addressesCol(uid), id));
  } catch (err) {
    console.warn('Failed to delete address:', err);
  }
}
