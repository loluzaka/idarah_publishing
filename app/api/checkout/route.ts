import { NextResponse } from "next/server";
import { verifyIdToken, getAdminDb } from "@/app/lib/firebase-admin";
import { client, urlFor } from "@/app/sanityClient";
import { calculateShipping, normalizeCountry, isIndianCountry } from "@/app/lib/shipping";
import { rateLimit, getClientIp, validatePhone, validateEmail, stripTags } from "@/app/lib/security";
import { getRazorpay, isMagicCheckoutEnabled } from "@/app/lib/razorpay-order";

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

interface SanityBook {
  _id: string;
  title?: string;
  authors?: unknown;
  price?: number;
  weightGrams?: number | null;
  coverImage?: unknown;
}

interface OrderLineItem {
  id: string;
  title?: string;
  authors: string[];
  price: number;
  quantity: number;
  weightGrams?: number;
}

interface RzpLineItem {
  sku: string;
  variant_id: string;
  price: number;
  offer_price: number;
  quantity: number;
  name: string;
  description: string;
  image_url: string;
  weight?: number;
}

// The SDK's typings don't cover Magic Checkout's line_items fields.
type RzpOrderCreate = (params: Record<string, unknown>) => Promise<{ id: string; amount: number }>;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://idarahbooks.in';

// POST /api/checkout
// Body: { items, address, customerName, customerPhone, customerEmail,
//         checkoutMode?: "auto" | "standard", orderId?: string }
// Header: Authorization: Bearer <firebase id token>
//
// Two payment flows, one endpoint:
//
//   MAGIC (primary) — Razorpay Magic Checkout. Used for Indian orders when
//   NEXT_PUBLIC_RAZORPAY_MAGIC_CHECKOUT=true. The Razorpay order carries line
//   items and EXCLUDES shipping: Razorpay collects the delivery address, asks
//   /api/magic-checkout/shipping for the fee, and adds it to what the customer
//   pays. The final address/shipping/amount are written back on payment
//   (see markOrderPaid).
//
//   STANDARD (fallback) — the original in-house flow: our own address form,
//   shipping computed here, a plain Razorpay order for the full total. Used for
//   international orders, when Magic is disabled, when Magic order creation
//   fails, or when the client retries with checkoutMode "standard" (e.g. the
//   Magic script failed to load). A retry passes the existing `orderId` so the
//   same Firestore order is reused instead of leaving an orphan behind.
export async function POST(req: Request) {
  try {
    // 0. Rate limit (best-effort; see security.ts note re: serverless resets).
    const ip = getClientIp(req);
    const rl = rateLimit(`checkout:${ip}`, 8, 60_000);
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

    const { items, address, customerName, customerPhone, customerEmail, checkoutMode, orderId: retryOrderId } =
      (await req.json()) as {
        items?: { bookId?: string; quantity?: unknown }[];
        address?: AddressInput;
        customerName?: unknown;
        customerPhone?: unknown;
        customerEmail?: unknown;
        checkoutMode?: string;
        orderId?: unknown;
      };
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "cart is empty" }, { status: 400 });
    }

    // 2. Sanitise inputs (validated below, once we know which flow applies).
    const name = stripTags(customerName, 120);
    const phone = stripTags(customerPhone, 20);
    const email = stripTags(customerEmail, 254);
    const addr = (address || {}) as AddressInput;
    const country = normalizeCountry(addr.country) || 'india';
    const isDomestic = isIndianCountry(country);

    const tryMagic = isMagicCheckoutEnabled() && isDomestic && checkoutMode !== "standard";

    if (email && !validateEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    // Magic collects contact + address itself, so only sanity-check what was typed.
    if (tryMagic && phone.trim() && !validatePhone(phone)) {
      return NextResponse.json({ error: "Please enter a valid Indian phone number." }, { status: 400 });
    }

    // 3. Fetch real prices + weights from Sanity. NEVER use client-supplied prices.
    const ids = items.map((i) => i.bookId);
    const books: SanityBook[] = await client.fetch(
      `*[_type == "book" && _id in $ids]{ _id, title, "authors": authors[]->name, price, weightGrams, coverImage }`,
      { ids }
    );
    const byId = new Map<string, SanityBook>(books.map((b) => [b._id, b]));

    let subtotal = 0;
    const lineItems: OrderLineItem[] = [];
    const rzpLineItems: RzpLineItem[] = [];
    const shippingItems: { quantity: number; weightGrams: number | null }[] = [];

    for (const item of items) {
      const book = item.bookId ? byId.get(item.bookId) : undefined;
      if (!book) {
        return NextResponse.json(
          { error: `book not found: ${item.bookId}` },
          { status: 400 }
        );
      }
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const unitPrice = Number(book.price) || 0;
      subtotal += unitPrice * qty;
      const authors: string[] = Array.isArray(book.authors)
        ? book.authors.filter((n: unknown): n is string => typeof n === 'string')
        : [];
      lineItems.push({
        id: book._id,
        title: book.title,
        authors,
        price: unitPrice,
        quantity: qty,
        ...(book.weightGrams != null ? { weightGrams: Number(book.weightGrams) } : {}),
      });
      let imageUrl = `${SITE_URL}/icon.png`;
      try { if (book.coverImage) imageUrl = urlFor(book.coverImage).width(600).url(); } catch { /* keep fallback */ }
      rzpLineItems.push({
        sku: book._id,
        variant_id: book._id,
        price: Math.round(unitPrice * 100),
        offer_price: Math.round(unitPrice * 100),
        quantity: qty,
        name: String(book.title || 'Book').slice(0, 125),
        description: (authors.join(', ') || String(book.title || 'Book')).slice(0, 250),
        image_url: imageUrl,
        ...(book.weightGrams != null ? { weight: Number(book.weightGrams) } : {}),
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

    // 7. Reuse the caller's pending order on a fallback retry, otherwise start a new one.
    let orderRef = db.collection("orders").doc();
    let isNewOrder = true;
    let displayOrderId = `IAD-${Math.floor(100000 + Math.random() * 900000)}`;
    if (typeof retryOrderId === "string" && retryOrderId) {
      const existing = await db.collection("orders").doc(retryOrderId).get();
      const data = existing.data();
      if (!existing.exists || data?.uid !== uid || data?.status !== "pending_payment") {
        return NextResponse.json({ error: "This order can no longer be retried. Please start again." }, { status: 409 });
      }
      orderRef = existing.ref;
      isNewOrder = false;
      displayOrderId = data?.orderId || displayOrderId;
    }
    const docId = orderRef.id;

    const baseOrder = {
      id: docId,
      orderId: displayOrderId,
      uid,
      items: lineItems,
      subtotal,
      discountRate: rawRate, // store in your existing format (percent)
      discountAmount,
      shippingWeight: shippingCalc.totalWeight,
      shippingCarrier: shippingCalc.carrier,
      shippingZone: shippingCalc.zone?.label ?? null,
      tax,
      status: "pending_payment",
      updatedAt: new Date(),
      ...(isNewOrder ? { createdAt: new Date() } : {}),
    };

    // ── MAGIC (primary) ───────────────────────────────────────────────────────
    if (tryMagic) {
      // Razorpay adds shipping itself, so amount/line_items_total exclude it.
      // The member discount is applied up front: lower BOTH by the same value
      // (Razorpay's rule) and leave the per-item prices untouched.
      const lineItemsPaise = rzpLineItems.reduce((s, li) => s + li.offer_price * li.quantity, 0);
      const discountPaise = Math.round(discountAmount * 100);
      const magicAmountPaise = lineItemsPaise - discountPaise;

      if (magicAmountPaise >= 100) {
        try {
          const rzpOrder = await (getRazorpay().orders as unknown as { create: RzpOrderCreate }).create({
            amount: magicAmountPaise,
            currency: "INR",
            receipt: docId,
            line_items_total: magicAmountPaise,
            line_items: rzpLineItems,
            notes: {
              orderId: docId,
              uid,
              ...(discountPaise > 0 ? { prediscount_applied: String(discountPaise) } : {}),
            },
          });

          await orderRef.set(
            {
              ...baseOrder,
              customerName: name,
              customerPhone: phone,
              customerEmail: email,
              address: {
                fullName: name, phone, email,
                addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "",
                country: "India",
              },
              shippingCost: null, // filled in from Razorpay once paid
              total: +(subtotal - discountAmount).toFixed(2), // excl. shipping until paid
              checkoutType: "magic",
              razorpayOrderId: rzpOrder.id,
            },
            { merge: true }
          );

          return NextResponse.json({
            checkoutType: "magic",
            orderId: docId,
            displayOrderId,
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount, // paise
            discountPaise,
          });
        } catch (err) {
          // Typically: Magic Checkout not yet enabled on this Razorpay account,
          // or Razorpay is rejecting the payload. Don't strand the customer —
          // drop to the standard flow below.
          console.error("[checkout] Magic Checkout order failed, falling back to standard:", err);
        }
      }
    }

    // ── STANDARD (fallback) ───────────────────────────────────────────────────
    if (!name.trim() || !phone.trim()) {
      return NextResponse.json(
        { error: "Please fill in name and phone." },
        { status: 400 }
      );
    }
    // Indian orders: strict Indian format. Foreign orders: lenient international format.
    const phoneOk = isDomestic ? validatePhone(phone) : validateForeignPhone(phone);
    if (!phoneOk) {
      return NextResponse.json(
        { error: isDomestic ? "Please enter a valid Indian phone number." : "Please enter a valid phone number (with country code, e.g. +1 555 000 1234)." },
        { status: 400 }
      );
    }
    if (!addr.addressLine1?.trim() || !addr.city?.trim() || !addr.postalCode?.trim()) {
      return NextResponse.json(
        { error: "Please fill in address, city, and postal code." },
        { status: 400 }
      );
    }

    const amountPaise = Math.round(total * 100);
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

    await orderRef.set(
      {
        ...baseOrder,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        address: fullAddress,
        shippingCost: shipping,
        total,
        checkoutType: "standard",
      },
      { merge: true }
    );

    const rzpOrder = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: docId,
      notes: { orderId: docId, uid },
    });

    await orderRef.update({ razorpayOrderId: rzpOrder.id });

    return NextResponse.json({
      checkoutType: "standard",
      orderId: docId,
      displayOrderId,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount, // paise
    });
  } catch (err) {
    console.error("[checkout] error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
