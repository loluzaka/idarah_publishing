import crypto from "crypto";
import { NextResponse } from "next/server";
import { verifyIdToken, getAdminDb } from "@/app/lib/firebase-admin";

// POST /api/payments/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId }
// Header: Authorization: Bearer <firebase id token>
//
// Verifies the signature returned by Razorpay Checkout and flips the order
// from "Pending Payment" to "Paid". The webhook route is the authoritative
// path; this is the fast client-side confirmation.
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
    const order = snap.data() as Record<string, any>;
    if (order.uid !== uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Razorpay signs: HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }

    await snap.ref.update({
      status: "Paid",
      payment: {
        method: "Razorpay",
        razorpay_order_id,
        razorpay_payment_id,
        paidAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, orderId });
  } catch (err) {
    console.error("[payments/verify] error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
