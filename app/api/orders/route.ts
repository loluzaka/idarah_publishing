import { NextResponse } from 'next/server';
import { createClient } from '@sanity/client';
import { rateLimit, getClientIp, validateEmail, validatePhone, sanitize, stripTags } from '@/app/lib/security';
import { verifyIdToken } from '@/app/lib/firebase-admin';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeError(err: any, fallback: string): string {
  const msg = typeof err?.message === 'string' ? err.message : '';
  if (!msg || /token|secret|key|bearer|credential/i.test(msg)) return fallback;
  return msg.length > 200 ? msg.slice(0, 200) : msg;
}

function json(body: object, status = 200) {
  return NextResponse.json(body, { status });
}

// ─── Payload validation ───────────────────────────────────────────────────────

interface CleanItem {
  id: string;
  title?: string;
  price: number;
  quantity: number;
}

interface CleanPayload {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  items: CleanItem[];
  totalAmount: number;
  userId: string;
}

function validatePayload(body: any): { ok: true; data: CleanPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Request body must be a JSON object.' };

  const { orderId, customerName, customerPhone, customerEmail, deliveryAddress, items, totalAmount, userId } = body;

  if (typeof orderId !== 'string' || !orderId.trim()) return { ok: false, error: 'orderId is required.' };
  if (typeof customerName !== 'string' || !customerName.trim()) return { ok: false, error: 'Customer name is required.' };
  if (typeof customerPhone !== 'string' || !customerPhone.trim()) return { ok: false, error: 'Phone number is required.' };
  if (!validatePhone(customerPhone)) return { ok: false, error: 'Please enter a valid Indian phone number (e.g. +919XXXXXXXXX).' };
  if (typeof deliveryAddress !== 'string' || !deliveryAddress.trim()) return { ok: false, error: 'Delivery address is required.' };
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'Your cart is empty. Add at least one book before checking out.' };
  if (typeof totalAmount !== 'number' || !Number.isFinite(totalAmount) || totalAmount < 0) {
    return { ok: false, error: 'Invalid order total.' };
  }

  // Email is optional but must be valid if provided
  if (customerEmail && typeof customerEmail === 'string' && customerEmail.trim()) {
    if (!validateEmail(customerEmail)) return { ok: false, error: 'Please enter a valid email address.' };
  }

  const cleanItems: CleanItem[] = [];
  for (const [i, raw] of items.entries()) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: `Item ${i + 1} is malformed.` };
    const id = typeof raw.id === 'string' ? raw.id : (typeof raw._id === 'string' ? raw._id : null);
    if (!id) return { ok: false, error: `Item ${i + 1} is missing an ID.` };
    const price = Number(raw.price);
    const quantity = Number(raw.quantity);
    if (!Number.isFinite(price) || price < 0) return { ok: false, error: `Item ${i + 1} has an invalid price.` };
    if (!Number.isFinite(quantity) || quantity < 1) return { ok: false, error: `Item ${i + 1} has an invalid quantity.` };
    cleanItems.push({
      id,
      title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : undefined,
      price,
      quantity: Math.floor(quantity),
    });
  }

  // Verify total matches items (within ₹1 rounding tolerance)
  const computedTotal = cleanItems.reduce((t, it) => t + it.price * it.quantity, 0);
  if (Math.abs(computedTotal - totalAmount) > 1) {
    return { ok: false, error: 'Order total does not match items. Please refresh and try again.' };
  }

  return {
    ok: true,
    data: {
      orderId:         orderId.trim().slice(0, 50),
      customerName:    stripTags(customerName, 100),
      customerPhone:   sanitize(customerPhone, 20),
      customerEmail:   typeof customerEmail === 'string' ? customerEmail.trim().slice(0, 254) : '',
      deliveryAddress: stripTags(deliveryAddress, 500),
      items:           cleanItems,
      totalAmount,
      userId:          typeof userId === 'string' && userId.trim() ? userId.trim().slice(0, 128) : 'authenticated_user',
    },
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Rate limit by IP: 5 orders per minute per IP
  const ip = getClientIp(request);
  const rl = rateLimit(`order:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return json(
      { success: false, error: `Too many requests. Please wait ${rl.retryAfter} seconds before trying again.` },
      429
    );
  }

  // 2. Auth: verify Firebase ID token
  const uid = await verifyIdToken(request.headers.get('Authorization'));
  if (!uid) {
    return json(
      { success: false, error: 'You must be signed in to place an order. Please log in and try again.' },
      401
    );
  }

  // 3. Sanity write token check
  const token = process.env.SANITY_WRITE_TOKEN;
  if (!token) {
    console.error('CRITICAL: SANITY_WRITE_TOKEN is not set.');
    return json({ success: false, error: 'Order service is temporarily unavailable. Please try again later.' }, 500);
  }

  // 4. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Invalid request format.' }, 400);
  }

  // 5. Validate + sanitize
  const result = validatePayload(body);
  if (!result.ok) {
    return json({ success: false, error: result.error }, 400);
  }
  const payload = result.data;

  // Override userId with the verified Firebase uid (never trust client-supplied uid)
  payload.userId = uid;

  // 6. Write to Sanity
  const writeClient = createClient({
    projectId: 'lvzmkv9e',
    dataset: 'production',
    token,
    useCdn: false,
    apiVersion: '2024-01-01',
  });

  try {
    const newOrder = await writeClient.create({
      _type: 'order',
      orderId: payload.orderId,
      status: 'pending_sync',
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      deliveryAddress: payload.deliveryAddress,
      totalAmount: payload.totalAmount,
      userId: payload.userId,
      items: payload.items.map((item: CleanItem) => ({
        _key: Math.random().toString(36).slice(2, 9),
        book: { _type: 'reference', _ref: item.id },
        quantity: item.quantity,
        pricePaid: item.price,
      })),
    });

    if (!newOrder?._id) throw new Error('Sanity did not return a document ID.');

    return json({ success: true, documentId: newOrder._id, orderId: payload.orderId });
  } catch (err: any) {
    console.error('Sanity order write failed:', err);
    return json(
      { success: false, error: safeError(err, 'Unable to save your order right now. Please try again in a moment.') },
      502
    );
  }
}
