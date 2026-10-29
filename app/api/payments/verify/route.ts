import crypto from "crypto";
import { NextResponse } from "next/server";
import { verifyIdToken, getAdminDb } from "@/app/lib/firebase-admin";
import { markOrderPaid } from "@/app/lib/razorpay-order";

// POST /api/payments/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId }
// Header: Authorization: Bearer <firebase id token>
//
// Verifies the signature returned by Razorpay Checkout (Standard OR Magic) and
// flips the order from pending_payment to paid. The webhook route is the
// authoritative path; this is the fast client-side confirmation.
export async function POST(req: Request) {
  try {
    const uid = await verifyIdToken(req.headers.get("authorization"));
    if (!uid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    const db = getAdminDb();
    const snap = await db.collection("orders").doc(orderId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const order = snap.data() as { uid?: string; razorpayOrderId?: string };
    if (order.uid !== uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // The signature must be for the Razorpay order WE created for this order —
    // otherwise a payment on some other (cheaper) Razorpay order could be
    // replayed against this one.
    if (!order.razorpayOrderId || order.razorpayOrderId !== razorpay_order_id) {
      return NextResponse.json({ error: "order mismatch" }, { status: 400 });
    }

    // Razorpay signs: HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${order.razorpayOrderId}|${razorpay_payment_id}`)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(String(razorpay_signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }

    await markOrderPaid(orderId, {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    return NextResponse.json({ ok: true, orderId });
  } catch (err) {
    console.error("[payments/verify] error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
