// Server-only helpers shared by /api/checkout, /api/payments/verify,
// /api/payments/webhook and /api/magic-checkout/shipping.

import Razorpay from "razorpay";
import { getAdminDb } from "@/app/lib/firebase-admin";

/** Magic Checkout is opt-in: it must be enabled on the Razorpay account first. */
export function isMagicCheckoutEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RAZORPAY_MAGIC_CHECKOUT === "true";
}

let _razorpay: Razorpay | null = null;
export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return _razorpay;
}

interface RzpAddress {
  name?: string;
  contact?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
}

interface RzpOrderDetails {
  amount_paid?: number | string;
  shipping_fee?: number | string;
  promotions?: unknown[];
  customer_details?: {
    contact?: string;
    email?: string;
    shipping_address?: RzpAddress;
  };
}

const COUNTRY_NAMES: Record<string, string> = { in: "India" };

function toOrderAddress(
  addr: RzpAddress | undefined,
  email: string | undefined,
  fallbackPhone: string | undefined
) {
  if (!addr) return null;
  const country = (addr.country || "in").toLowerCase();
  return {
    fullName: addr.name || "",
    phone: addr.contact || fallbackPhone || "",
    email: email || "",
    addressLine1: addr.line1 || "",
    addressLine2: addr.line2 || "",
    city: addr.city || "",
    state: addr.state || "",
    postalCode: addr.zipcode || "",
    country: COUNTRY_NAMES[country] ?? addr.country ?? "India",
  };
}

/**
 * Flip an order from pending_payment to paid. Idempotent — called by both the
 * client verify route and the webhook, in either order — and it never moves an
 * order that is already past `paid` (packed / shipped / …) backwards.
 *
 * Magic Checkout orders are created without an address or shipping fee (Razorpay
 * collects both), so for those the final address, shipping and amount actually
 * charged are pulled from Razorpay's Fetch Order API and written onto the order.
 */
export async function markOrderPaid(
  orderDocId: string,
  payment: { razorpayOrderId: string; razorpayPaymentId: string; amountPaise?: number }
): Promise<"updated" | "already-paid" | "not-found"> {
  const ref = getAdminDb().collection("orders").doc(orderDocId);
  const snap = await ref.get();
  if (!snap.exists) return "not-found";
  const order = snap.data() as Record<string, unknown> & { status?: string; checkoutType?: string; customerName?: string; customerPhone?: string; customerEmail?: string };
  if (order.status !== "pending_payment") return "already-paid";

  const now = new Date();
  const update: Record<string, unknown> = {
    status: "paid",
    paidAt: now,
    updatedAt: now,
    razorpayOrderId: payment.razorpayOrderId,
    "payment.method": "Razorpay",
    "payment.razorpay_order_id": payment.razorpayOrderId,
    "payment.razorpay_payment_id": payment.razorpayPaymentId,
    "payment.paidAt": now,
  };
  if (payment.amountPaise != null) update["payment.amount"] = payment.amountPaise;

  if (order.checkoutType === "magic") {
    try {
      const rzpOrder = (await getRazorpay().orders.fetch(payment.razorpayOrderId)) as unknown as RzpOrderDetails;
      const details = rzpOrder.customer_details || {};
      const address = toOrderAddress(
        details.shipping_address,
        details.email || order.customerEmail,
        details.contact || order.customerPhone
      );
      if (address) {
        update.address = address;
        update.customerName = address.fullName || order.customerName || "";
        update.customerPhone = address.phone || order.customerPhone || "";
        update.customerEmail = address.email || order.customerEmail || "";
      }
      const shippingPaise = Number(rzpOrder.shipping_fee) || 0;
      update.shippingCost = shippingPaise / 100;
      update.shippingCarrier = "India Post — Gyan Post";
      if (Number(rzpOrder.amount_paid) > 0) update.total = Number(rzpOrder.amount_paid) / 100;
      if (Array.isArray(rzpOrder.promotions) && rzpOrder.promotions.length) {
        update.promotions = rzpOrder.promotions;
      }
      if (!address) update.needsAddressReview = true;
    } catch (err) {
      // Payment is real even if the detail lookup failed — mark paid and flag
      // the order so the admin fills the address in from the Razorpay dashboard.
      console.error("[markOrderPaid] could not fetch Magic Checkout order details:", err);
      update.needsAddressReview = true;
    }
  }

  await ref.update(update);
  return "updated";
}
