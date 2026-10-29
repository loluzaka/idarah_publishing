import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/app/lib/firebase-admin";
import { markOrderPaid } from "@/app/lib/razorpay-order";

// POST /api/payments/webhook
// Configured in Razorpay Dashboard → Settings → Webhooks.
// Events: payment.captured, order.paid (Magic Checkout fires order.paid when a
// prepaid order completes — enable both).
//
// AUTHORITATIVE confirmation. If the customer closes the tab before the
// client verify call runs, this still marks the order paid. Keep enabled.
export async function POST(req: Request) {
  try {
    // Razorpay signs the raw body — read as text first, parse after.
    const body = await req.text();
    const sig = req.headers.get("x-razorpay-signature") || "";

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      // Return 200 to avoid retries, but take no action.
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    const event = JSON.parse(body);

    if (event.event === "payment.captured" || event.event === "order.paid") {
      const payment = event.payload?.payment?.entity;
      const rzpOrder = event.payload?.order?.entity;
      const razorpayOrderId: string | undefined = payment?.order_id ?? rzpOrder?.id;
      const razorpayPaymentId: string | undefined = payment?.id;

      if (razorpayOrderId && razorpayPaymentId) {
        // Our order id travels in the Razorpay order notes; fall back to a
        // lookup by Razorpay order id if the notes didn't reach the payment.
        let orderId: string | undefined = payment?.notes?.orderId ?? rzpOrder?.notes?.orderId;
        if (!orderId) {
          const q = await getAdminDb()
            .collection("orders")
            .where("razorpayOrderId", "==", razorpayOrderId)
            .limit(1)
            .get();
          orderId = q.docs[0]?.id;
        }
        if (orderId) {
          await markOrderPaid(orderId, {
            razorpayOrderId,
            razorpayPaymentId,
            amountPaise: payment?.amount,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[payments/webhook] error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
