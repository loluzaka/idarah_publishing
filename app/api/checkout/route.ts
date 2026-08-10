import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { verifyIdToken, getAdminDb } from "@/app/lib/firebase-admin";
import { client } from "@/app/sanityClient";
import { calculateShipping, normalizeCountry, isIndianCountry } from "@/app/lib/shipping";
import { rateLimit, getClientIp, validatePhone, validateEmail, stripTags } from "@/app/lib/security";

// Razorpay is initialised once per cold start with your server-side keys.
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

interface AddressInput {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

// Lenient phone check for foreign orders: 7–15 digits, optional + and separators.
// (validatePhone() only accepts Indian numbers.)
function validateForeignPhone(phone: unknown): boolean {
  if (typeof phone !== 'string') return false;
  const digits = phone.replace(/[\s\-().]/g, '');
  return /^\+?\d{7,15}$/.test(digits);
}

// POST /api/checkout
// Body: { items, address, customerName, customerPhone, customerEmail }
// Header: Authorization: Bearer <firebase id token>
//
// Straight-payment flow for DOMESTIC (India) and INTERNATIONAL orders:
//   1. rate-limit + authenticate
//   2. fetch REAL prices + weights from Sanity (never trust client prices)
//   3. compute shipping: Gyan Post (India) or International Speed Post (foreign)
//   4. apply the user's discount rate from Firestore
//   5. create the Firestore order (status: pending_payment)
//   6. create the Razorpay order
//   7. return the razorpay order id + amount so the client opens checkout
export async function POST(req: Request) {
  try {
    // 0. Rate limit (best-effort; see security.ts note re: serverless resets).
    const ip = getClientIp(req);
    const rl = rateLimit(`checkout:${ip}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryAfter}s.` },
        { status: 429 }
      );
    }

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

    // 2. Validate + sanitise inputs.
    const name = stripTags(customerName, 120);
    const phone = stripTags(customerPhone, 20);
    const email = stripTags(customerEmail, 254);
    const addr = (address || {}) as AddressInput;
    const country = normalizeCountry(addr.country) || 'india';
    const isDomestic = isIndianCountry(country);

    if (!name.trim() || !phone.trim()) {
      return NextResponse.json(
        { error: "Please fill in name and phone." },
        { status: 400 }
      );
    }
    // Indian orders: strict Indian format. Foreign orders: lenient international format.
    const phoneOk = isDomestic
      ? validatePhone(phone)
      : validateForeignPhone(phone);
    if (!phoneOk) {
      return NextResponse.json(
        { error: isDomestic ? "Please enter a valid Indian phone number." : "Please enter a valid phone number (with country code, e.g. +1 555 000 1234)." },
        { status: 400 }
      );
    }
    if (email && !validateEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (!addr.addressLine1?.trim() || !addr.city?.trim() || !addr.postalCode?.trim()) {
      return NextResponse.json(
        { error: "Please fill in address, city, and postal code." },
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
        id: book._id,
        title: book.title,
        price: unitPrice,
        quantity: qty,
        ...(book.weightGrams != null ? { weightGrams: Number(book.weightGrams) } : {}),
      });
      shippingItems.push({
        quantity: qty,
        weightGrams: book.weightGrams == null ? null : Number(book.weightGrams),
      });
    }
    subtotal = +subtotal.toFixed(2);

    // 4. Weight-based shipping — domestic Gyan Post or international Speed Post.
    const shippingCalc = calculateShipping(shippingItems, { country });
    if (shippingCalc.requiresQuote) {
      return NextResponse.json(
        { error: (isDomestic ? "Your order exceeds 5 kg." : "Your order exceeds the international weight limit.") + " Please contact us via WhatsApp for a shipping quote." },
        { status: 400 }
      );
    }
    const shipping = shippingCalc.cost as number;

    // 5. User discount rate from Firestore (percent; handle fraction too).
    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() || {};
    const rawRate = Number(userData.discountRate) || 0;
    const discountRate = rawRate > 1 ? rawRate / 100 : rawRate; // 10 -> 0.10
    const discountAmount = +(subtotal * discountRate).toFixed(2);

    // 6. Tax. Books are GST-nil/0% in India. Exports are also 0% (IGST nil).
    const tax = 0;

    const total = +(subtotal - discountAmount + shipping + tax).toFixed(2);
    if (total <= 0) {
      return NextResponse.json({ error: "invalid total" }, { status: 400 });
    }
    const amountPaise = Math.round(total * 100);

    // 7. Build the full address record.
    const fullAddress = {
      fullName: name,
      phone,
      email: email || "",
      addressLine1: stripTags(addr.addressLine1, 200),
      addressLine2: stripTags(addr.addressLine2, 200),
      city: stripTags(addr.city, 100),
      state: stripTags(addr.state, 100),
      postalCode: stripTags(addr.postalCode, 20),
      country: addr.country || "India",
    };

    // 8. Create the Firestore order (pending_payment) with a readable order id.
    const orderRef = db.collection("orders").doc();
    const docId = orderRef.id;
    const orderId = `IAD-${Math.floor(100000 + Math.random() * 900000)}`;
    await orderRef.set({
      id: docId,
      orderId,
      uid,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      items: lineItems,
      address: fullAddress,
      subtotal,
      discountRate: rawRate, // store in your existing format (percent)
      discountAmount,
      shippingCost: shipping,
      shippingWeight: shippingCalc.totalWeight,
      shippingCarrier: shippingCalc.carrier,
      shippingZone: shippingCalc.zone?.label ?? null,
      tax,
      total,
      status: "pending_payment",
      createdAt: new Date(),
    });

    // 9. Create the Razorpay order tied to this order.
    const rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: docId,
      notes: { orderId: docId, uid },
    });

    await orderRef.update({ razorpayOrderId: rzpOrder.id });

    return NextResponse.json({
      orderId: docId,
      displayOrderId: orderId,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount, // paise
    });
  } catch (err) {
    console.error("[checkout] error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
