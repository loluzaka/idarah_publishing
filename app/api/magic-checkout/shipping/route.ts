import { NextResponse } from "next/server";
import { getAdminDb } from "@/app/lib/firebase-admin";
import { calculateShipping } from "@/app/lib/shipping";

// Razorpay Magic Checkout → "URL for shipping info"
// Dashboard → Magic Checkout → Shipping Setup → API →
//   https://<your-domain>/api/magic-checkout/shipping
//
// Razorpay calls this (unauthenticated, per their contract) with the customer's
// saved/entered addresses and expects the shipping options + fee for each. The
// docs list the method as GET but describe a JSON body, so both are accepted.
//
// Nothing sensitive is returned — only a fee — and the call is tied to a real
// pending order (receipt + Razorpay order id must match) so it can't be used
// to probe arbitrary data.

interface ShippingRequest {
  order_id?: unknown;
  razorpay_order_id?: unknown;
  addresses?: { id?: string; zipcode?: string; country?: string }[];
}

interface StoredItem {
  quantity?: unknown;
  weightGrams?: unknown;
}

const RESPONSE_HEADERS = { "Cache-Control": "no-store" };

async function handle(req: Request) {
  try {
    let body: ShippingRequest = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const receipt = typeof body.order_id === "string" ? body.order_id : "";
    const rzpOrderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
    const addresses = Array.isArray(body.addresses) ? body.addresses : [];
    if (!receipt || !rzpOrderId) {
      return NextResponse.json({ error: "missing order" }, { status: 400 });
    }

    const snap = await getAdminDb().collection("orders").doc(receipt).get();
    const order = snap.data();
    // Razorpay sends the id without the "order_" prefix.
    const stored = String(order?.razorpayOrderId || "").replace(/^order_/, "");
    if (!snap.exists || !order || stored !== rzpOrderId.replace(/^order_/, "")) {
      return NextResponse.json({ error: "order not found" }, { status: 404 });
    }

    // Domestic Gyan Post is weight-based and distance-independent, so the fee is
    // the same for every Indian address; non-Indian addresses aren't serviceable
    // through Magic Checkout (international orders use the standard flow).
    const calc = calculateShipping(
      ((order.items || []) as StoredItem[]).map((i) => ({
        quantity: Number(i.quantity) || 1,
        weightGrams: i.weightGrams == null ? null : Number(i.weightGrams),
      })),
      { country: "india" }
    );
    const feePaise = calc.requiresQuote ? 0 : Math.round((calc.cost as number) * 100);

    return NextResponse.json(
      {
        addresses: addresses.map((a) => {
          const serviceable =
            !calc.requiresQuote && String(a?.country || "in").toLowerCase() === "in";
          return {
            id: a?.id,
            zipcode: a?.zipcode,
            country: a?.country,
            shipping_methods: [
              {
                id: "gyan-post",
                name: "India Post — Gyan Post",
                description: "Delivered by India Post",
                serviceable,
                shipping_fee: serviceable ? feePaise : 0,
                cod: false,
                cod_fee: 0,
              },
            ],
          };
        }),
      },
      { headers: RESPONSE_HEADERS }
    );
  } catch (err) {
    console.error("[magic-checkout/shipping] error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
