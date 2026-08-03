import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/app/lib/firebase-admin";

// POST /api/payments/webhook
// Configured in Razorpay Dashboard → Settings → Webhooks.
// Event: payment.captured
//
// AUTHORITATIVE confirmation. If the customer closes the tab before the
// client verify call runs, this still marks the order Paid. Keep enabled.
export async function POST(req: Request) {
  try {
    // Razorpay signs the raw body — read as text first, parse after.
    const body = await req.text();
    const sig = req.headers.get("x-razorpay-signature") || "";

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest("hex");

    if (expected !== sig) {
      // Return 200 to avoid retries, but take no action.
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    const event = JSON.parse(body);

    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.notes?.orderId;
      if (orderId) {
        await getAdminDb().collection("orders").doc(orderId).update({
          status: "Paid",
          "payment.method": "Razorpay",
          "payment.razorpay_payment_id": payment.id,
          "payment.razorpay_order_id": payment.order_id,
          "payment.amount": payment.amount, // paise
          "payment.paidAt": new Date(),
        });
      }
    }

    // Optional: handle refund / failure events here later.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[payments/webhook] error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
