import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { verifyIdToken, getAdminDb } from "@/app/lib/firebase-admin";
import { client } from "@/app/sanityClient";
import { calculateShipping } from "@/app/lib/shipping";

// Razorpay is initialised once per cold start with your server-side keys.
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

interface AddressInput {
  fullName?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

// POST /api/checkout
// Body: { items: [{ bookId, quantity }], address: AddressInput, customerName, customerPhone, customerEmail }
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

    const { items, address, customerName, customerPhone, customerEmail } =
      await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "cart is empty" }, { status: 400 });
    }

    // 2. Validate the address (mirrors the old client-side required check).
    const addr = (address || {}) as AddressInput;
    if (
      !customerName?.trim() ||
      !customerPhone?.trim() ||
      !addr.addressLine1?.trim() ||
      !addr.city?.trim() ||
      !addr.postalCode?.trim()
    ) {
      return NextResponse.json(
        { error: "Please fill in name, phone, address, city, and postal code." },
        { status: 400 }
      );
    }

    // 3. Fetch real prices + weights from Sanity. NEVER use client-supplied prices.
    const ids = items.map((i: any) => i.bookId);
    const books = await client.fetch(
      `*[_type == "book" && _id in $ids]{ _id, title, price, weightGrams }`,
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
        weightGrams: book.weightGrams == null ? null : Number(book.weightGrams),
      });
    }
    subtotal = +subtotal.toFixed(2);

    // 4. Weight-based shipping (India Post Gyan Post). Over 5 kg → requires a quote.
    const shippingCalc = calculateShipping(shippingItems);
    if (shippingCalc.requiresQuote) {
      return NextResponse.json(
        { error: "Your order exceeds 5 kg. Please contact us via WhatsApp for institutional or bulk shipping." },
        { status: 400 }
      );
    }
    const shipping = shippingCalc.cost as number;

    // 5. User discount rate from Firestore.
    //    Stored as a percentage (e.g. 10 == 10%) per your UI; handle both formats.
    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() || {};
    const rawRate = Number(userData.discountRate) || 0;
    const discountRate = rawRate > 1 ? rawRate / 100 : rawRate; // 10 -> 0.10
    const discount = +(subtotal * discountRate).toFixed(2);

    // 6. Tax. Books are GST-nil/0% in India — adjust if your catalogue changes.
    const tax = 0;

    const total = +(subtotal - discount + shipping + tax).toFixed(2);
    if (total <= 0) {
      return NextResponse.json({ error: "invalid total" }, { status: 400 });
    }
    const amountPaise = Math.round(total * 100);

    // 7. Build the full address record (merge form fields + passed address).
    const fullAddress = {
      fullName: customerName,
      phone: customerPhone,
      email: customerEmail || addr.email || "",
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || "",
      city: addr.city,
      state: addr.state || "",
      postalCode: addr.postalCode,
      country: addr.country || "India",
    };

    // 8. Create the Firestore order (Pending Payment).
    const orderRef = db.collection("orders").doc();
    const orderId = orderRef.id;
    await orderRef.set({
      id: orderId,
      uid,
      customerName,
      customerPhone,
      customerEmail,
      items: lineItems,
      address: fullAddress,
      subtotal,
      discount,
      discountRate: rawRate, // store in your existing format (percent)
      shippingCost: shipping,
      shippingWeight: shippingCalc.totalWeight,
      tax,
      total,
      status: "Pending Payment",
      createdAt: new Date(),
    });

    // 9. Create the Razorpay order tied to this order.
    const rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: orderId,
      notes: { orderId, uid },
    });

    await orderRef.update({ razorpayOrderId: rzpOrder.id });

    return NextResponse.json({
      orderId,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount, // paise
    });
  } catch (err) {
    console.error("[checkout] error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
