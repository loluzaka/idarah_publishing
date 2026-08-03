import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { verifyIdToken, getAdminDb } from "@/app/lib/firebase-admin";
import { client } from "@/app/lib/sanityClient";
import { calculateShipping } from "@/app/lib/shipping";

// Razorpay is initialised once per cold start with your server-side keys.
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// POST /api/checkout
// Body: { items: [{ bookId, quantity }], addressId }
// Header: Authorization: Bearer <firebase id token>
//
// Straight-payment flow (no admin verification):
//   1. authenticate the user (verifyIdToken)
//   2. fetch REAL prices + weights from Sanity (never trust client prices)
//   3. compute weight-based shipping via your shipping.ts (Gyan Post)
//   4. apply the user's discount rate from Firestore
//   5. create the Firestore order (status: "Pending Payment")
//   6. create the Razorpay order
//   7. return the razorpay order id + amount so the client opens checkout
export async function POST(req: Request) {
  try {
    // 1. Authenticate.
    const uid = await verifyIdToken(req.headers.get("authorization"));
    if (!uid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { items, addressId } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "cart is empty" }, { status: 400 });
    }
    if (!addressId) {
      return NextResponse.json({ error: "select a shipping address" }, { status: 400 });
    }

    // 2. Fetch real prices + weights from Sanity. NEVER use client-supplied prices.
    const ids = items.map((i: any) => i.bookId);
    const books = await client.fetch(
      `*[_id in $ids]{ _id, title, price, weight }`,
      { ids }
    );
    const byId = new Map<string, any>(books.map((b: any) => [b._id, b]));

    let subtotal = 0;
    const lineItems: any[] = [];
    const shippingItems: { quantity: number; weightGrams: number | null }[] = [];

    for (const item of items) {
      const book = byId.get(item.bookId);
      if (!book) {
        return NextResponse.json(
          { error: `book not found: ${item.bookId}` },
          { status: 400 }
        );
      }
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const unitPrice = Number(book.price) || 0;
      subtotal += unitPrice * qty;
      lineItems.push({
        bookId: book._id,
        title: book.title,
        price: unitPrice,
        quantity: qty,
      });
      shippingItems.push({
        quantity: qty,
        weightGrams: book.weight == null ? null : Number(book.weight),
      });
    }
    subtotal = +subtotal.toFixed(2);

    // 3. Weight-based shipping (India Post Gyan Post). Over 5 kg → requires a quote.
    const shippingCalc = calculateShipping(shippingItems);
    if (shippingCalc.requiresQuote) {
      return NextResponse.json(
        { error: shippingCalc.message || "shipping requires a quote for this weight" },
        { status: 400 }
      );
    }
    const shipping = shippingCalc.cost as number;

    // 4. User discount rate from Firestore (admin-set, per your discounts model).
    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() || {};
    const discountRate = Number(userData.discountRate) || 0; // e.g. 0.10 = 10%
    const discount = +(subtotal * discountRate).toFixed(2);

    // 5. Tax. Books are GST-nil/0% in India — adjust if your catalogue changes.
    const tax = 0;

    const total = +(subtotal - discount + shipping + tax).toFixed(2);
    if (total <= 0) {
      return NextResponse.json({ error: "invalid total" }, { status: 400 });
    }
    const amountPaise = Math.round(total * 100);

    // 6. Resolve the shipping address from the user's saved addresses.
    const addresses: any[] = userData.addresses || [];
    const address = addresses.find((a: any) => a.id === addressId);
    if (!address) {
      return NextResponse.json({ error: "address not found" }, { status: 400 });
    }

    // 7. Create the Firestore order (Pending Payment).
    const orderRef = db.collection("orders").doc();
    await orderRef.set({
      id: orderRef.id,
      uid,
      items: lineItems,
      address,
      subtotal,
      discount,
      discountRate,
      shipping,
      shippingWeight: shippingCalc.totalWeight,
      tax,
      total,
      status: "Pending Payment",
      createdAt: new Date(),
    });

    // 8. Create the Razorpay order tied to this order.
    const rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: orderRef.id,
      notes: { orderId: orderRef.id, uid },
    });

    await orderRef.update({ razorpayOrderId: rzpOrder.id });

    return NextResponse.json({
      orderId: orderRef.id,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount, // paise
    });
  } catch (err) {
    console.error("[checkout] error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
