// Firestore order collection — straight-payment workflow.
// Order lifecycle:
//   pending_payment → paid → packed → shipped → delivered
// (cancelled is a terminal state available at any point)
//
// Canonical order shape — written by /api/checkout, /api/payments/verify,
// /api/payments/webhook. Read by this lib (profile + admin).

import { db } from './firebase';
import {
  collection,
  doc,
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
  'pending_payment',
  'paid',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pending Payment',
  paid:            'Paid',
  packed:          'Packed',
  shipped:         'Shipped',
  delivered:       'Delivered',
  cancelled:       'Cancelled',
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

export interface OrderPayment {
  method: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  paidAt?: number;
}

export interface Order {
  id?: string;            // Firestore doc id
  orderId: string;        // readable IAD-XXXXXX
  uid: string;            // Firebase uid (was `userId` in legacy)
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: OrderAddress;
  items: OrderItem[];
  subtotal: number;
  discountRate: number;       // percent (e.g. 10)
  discountAmount: number;
  shippingCost: number | null;
  shippingWeight: number;
  tax: number;
  total: number;              // canonical final total
  status: OrderStatus;
  razorpayOrderId?: string;
  payment?: OrderPayment;
  adminNotes?: string;
  createdAt?: number;
  updatedAt?: number;
  paidAt?: number;
  shippedAt?: number;
  trackingNumber?: string;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

function ordersCol() {
  return collection(db, 'orders');
}

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
  if (v instanceof Timestamp) return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return undefined;
}

// Normalises an item from either the new ({bookId, weightGrams}) or legacy ({id}) shape.
function normItem(raw: any): OrderItem {
  return {
    id: raw.id ?? raw.bookId ?? '',
    title: raw.title ?? '',
    author: raw.author,
    price: Number(raw.price) || 0,
    quantity: Number(raw.quantity) || 1,
    weightGrams: raw.weightGrams != null ? Number(raw.weightGrams) : undefined,
  };
}

function fromSnap(id: string, data: any): Order {
  const status = (ORDER_STATUSES as readonly string[]).includes(data.status)
    ? data.status
    : 'pending_payment';
  const total = Number(data.total ?? data.estimatedTotal ?? data.finalTotal ?? 0);
  return {
    id,
    orderId: data.orderId ?? id,
    uid: data.uid ?? data.userId ?? '',
    customerName: data.customerName ?? '',
    customerPhone: data.customerPhone ?? '',
    customerEmail: data.customerEmail ?? '',
    address: data.address ?? {},
    items: Array.isArray(data.items) ? data.items.map(normItem) : [],
    subtotal: Number(data.subtotal) || 0,
    discountRate: Number(data.discountRate) || 0,
    discountAmount: Number(data.discountAmount) || 0,
    shippingCost: data.shippingCost == null ? null : Number(data.shippingCost),
    shippingWeight: Number(data.shippingWeight ?? data.totalWeight) || 0,
    tax: Number(data.tax) || 0,
    total,
    status,
    razorpayOrderId: data.razorpayOrderId ?? undefined,
    payment: data.payment ?? undefined,
    adminNotes: data.adminNotes ?? undefined,
    createdAt: toMs(data.createdAt),
    updatedAt: toMs(data.updatedAt),
    paidAt: toMs(data.paidAt ?? data.payment?.paidAt),
    shippedAt: toMs(data.shippedAt),
    trackingNumber: data.trackingNumber ?? undefined,
  };
}

/** Orders for one user, newest first. Queries by `uid` (new shape). */
export async function getUserOrders(userId: string): Promise<Order[]> {
  if (!userId) return [];
  try {
    const q = query(ordersCol(), where('uid', '==', userId), orderBy('createdAt', 'desc'));
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
 * Admin operation — advance an order to a new status, optionally adjust
 * shipping/total, store tracking info, or add notes.
 * `orderDocId` is the Firestore document id (Order.id).
 */
export async function updateOrder(
  orderDocId: string,
  updates: Partial<Order> & { status?: OrderStatus }
): Promise<void> {
  const payload = stripUndefined({ ...updates, updatedAt: serverTimestamp() } as Record<string, any>);

  // Auto-stamp state transition timestamps
  if (updates.status === 'paid') payload.paidAt = serverTimestamp();
  if (updates.status === 'shipped') payload.shippedAt = serverTimestamp();

  await updateDoc(doc(ordersCol(), orderDocId), payload);
}

/** Generate a readable order id: IAD-XXXXXX. */
export function generateOrderId(): string {
  return `IAD-${Math.floor(100000 + Math.random() * 900000)}`;
}
