// Firestore order collection — publisher verification workflow.
// Order lifecycle:
//   pending_verification → verified → awaiting_payment → paid → packing → shipped → delivered
// (rejected / cancelled are terminal states available at any point)

import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

export const ORDER_STATUSES = [
  'pending_verification',
  'verified',
  'awaiting_payment',
  'paid',
  'packing',
  'shipped',
  'delivered',
  'cancelled',
  'rejected',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_verification: 'Pending Verification',
  verified:             'Verified',
  awaiting_payment:     'Awaiting Payment',
  paid:                 'Paid',
  packing:              'Packing',
  shipped:              'Shipped',
  delivered:            'Delivered',
  cancelled:            'Cancelled',
  rejected:             'Rejected',
};

export interface OrderItem {
  id: string;
  title: string;
  author?: string;
  price: number;         // customer-final unit price (₹, post-discount)
  quantity: number;
  weightGrams?: number;
}

export interface OrderAddress {
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country?: string;
}

export interface Order {
  id?: string;
  orderId: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: OrderAddress;
  items: OrderItem[];
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  shippingCost: number | null;
  totalWeight: number;
  estimatedTotal: number;
  finalTotal?: number;
  status: OrderStatus;
  adminNotes?: string;
  paymentLink?: string;
  createdAt?: number;
  updatedAt?: number;
  verifiedAt?: number;
  paidAt?: number;
  shippedAt?: number;
  trackingNumber?: string;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

function ordersCol() {
  return collection(db, 'orders');
}

// Firestore does not accept `undefined` — drop any key whose value is undefined.
// Only recurses into PLAIN objects ({}) — Firestore FieldValue / Timestamp sentinels
// are left untouched by checking Object.getPrototypeOf === Object.prototype.
function isPlainObject(v: unknown): v is Record<string, any> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function stripUndefined(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (isPlainObject(v)) {
      result[k] = stripUndefined(v);
    } else if (Array.isArray(v)) {
      result[k] = v.map(item => isPlainObject(item) ? stripUndefined(item) : item);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function toMs(v: any): number | undefined {
  return v instanceof Timestamp ? v.toMillis() : undefined;
}

function fromSnap(id: string, data: any): Order {
  return {
    id,
    orderId: data.orderId,
    userId: data.userId,
    customerName: data.customerName ?? '',
    customerPhone: data.customerPhone ?? '',
    customerEmail: data.customerEmail ?? '',
    address: data.address ?? {},
    items: Array.isArray(data.items) ? data.items : [],
    subtotal: Number(data.subtotal) || 0,
    discountRate: Number(data.discountRate) || 0,
    discountAmount: Number(data.discountAmount) || 0,
    shippingCost: data.shippingCost == null ? null : Number(data.shippingCost),
    totalWeight: Number(data.totalWeight) || 0,
    estimatedTotal: Number(data.estimatedTotal) || 0,
    finalTotal: data.finalTotal != null ? Number(data.finalTotal) : undefined,
    status: (ORDER_STATUSES as readonly string[]).includes(data.status) ? data.status : 'pending_verification',
    adminNotes: data.adminNotes ?? undefined,
    paymentLink: data.paymentLink ?? undefined,
    createdAt: toMs(data.createdAt),
    updatedAt: toMs(data.updatedAt),
    verifiedAt: toMs(data.verifiedAt),
    paidAt: toMs(data.paidAt),
    shippedAt: toMs(data.shippedAt),
    trackingNumber: data.trackingNumber ?? undefined,
  };
}

/** Orders for one user, newest first. */
export async function getUserOrders(userId: string): Promise<Order[]> {
  if (!userId) return [];
  try {
    const q = query(ordersCol(), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => fromSnap(d.id, d.data()));
  } catch (err) {
    console.warn('getUserOrders failed (may need composite index):', err);
    return [];
  }
}

/** All orders — admin only, newest first. */
export async function getAllOrders(): Promise<Order[]> {
  try {
    const q = query(ordersCol(), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => fromSnap(d.id, d.data()));
  } catch (err) {
    console.warn('getAllOrders failed:', err);
    return [];
  }
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Create an order request. Status starts as `pending_verification` — no payment yet.
 * Uses the readable `orderId` (IAD-XXXXXX) as the Firestore doc ID for easy lookup.
 */
export async function createOrder(input: Omit<Order, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Order> {
  const ref = doc(ordersCol(), input.orderId);
  const rawPayload = {
    ...input,
    status: 'pending_verification' as OrderStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const payload = stripUndefined(rawPayload as Record<string, any>);
  await setDoc(ref, payload);
  const saved = await getDoc(ref);
  return fromSnap(ref.id, saved.data() ?? {});
}

/**
 * Admin operation — advance an order to a new status, optionally attach a payment link,
 * adjust the final total (if shipping/discount changed), or store tracking info.
 */
export async function updateOrder(
  orderDocId: string,
  updates: Partial<Order> & { status?: OrderStatus }
): Promise<void> {
  const payload = stripUndefined({ ...updates, updatedAt: serverTimestamp() } as Record<string, any>);

  // Auto-stamp state transition timestamps
  if (updates.status === 'verified') payload.verifiedAt = serverTimestamp();
  if (updates.status === 'paid') payload.paidAt = serverTimestamp();
  if (updates.status === 'shipped') payload.shippedAt = serverTimestamp();

  await updateDoc(doc(ordersCol(), orderDocId), payload);
}
