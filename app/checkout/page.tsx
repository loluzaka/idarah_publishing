"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { CartItem, readCart, clearCart, cartSubtotal } from '@/app/lib/cart';
import { client } from '@/app/sanityClient';
import { calculateShipping, PACKAGING_WEIGHT_GRAMS } from '@/app/lib/shipping';
import { useUserProfile } from '@/app/hooks/useUserProfile';
import { ShoppingBag, Download, MessageCircle, Home, Package, AlertCircle, CheckCircle } from 'lucide-react';
import PayButton from '@/app/components/PayButton';

const WHATSAPP_NUMBER = '919810173618';
const COUNTRIES = [
  'India',
  'Pakistan', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Bhutan',
  'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Kuwait', 'Bahrain',
  'United Kingdom', 'United States', 'Canada', 'Australia', 'Germany', 'France',
  'Malaysia', 'Indonesia', 'Singapore', 'South Africa',
  'Other / Rest of World',
];

interface EnrichedItem extends CartItem {
  weightGrams?: number;
  originalPrice?: number;
  basePrice?: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { discountRate } = useUserProfile();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [enriched, setEnriched] = useState<EnrichedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('India');


  const [idToken, setIdToken] = useState('');
  const [orderComplete, setOrderComplete] = useState(false);
  const [generatedOrderId, setGeneratedOrderId] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    else if (user) {
      setCustomerName(user.displayName || '');
      setCustomerEmail(user.email || '');
      // Get a fresh Firebase ID token for the checkout API call.
      user.getIdToken().then(setIdToken).catch(() => setIdToken(''));
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading) return;
    setCart(readCart());
    setLoading(false);
  }, [user, authLoading]);

  useEffect(() => {
    if (cart.length === 0) { setEnriched([]); return; }
    (async () => {
      try {
        const ids = cart.map(i => i.id);
        const books: any[] = await client.fetch(
          `*[_type == "book" && _id in $ids]{ _id, weightGrams, price, originalPrice }`,
          { ids }
        );
        const bookMap = new Map(books.map(b => [b._id, b]));
        setEnriched(cart.map(item => {
          const b = bookMap.get(item.id);
          return {
            ...item,
            weightGrams: b?.weightGrams ?? undefined,
            basePrice: b?.price ?? undefined,
            originalPrice: b?.originalPrice ?? undefined,
          };
        }));
      } catch (err) {
        console.warn('Failed to load book weights:', err);
        setEnriched(cart.map(i => ({ ...i })));
      }
    })();
  }, [cart]);

  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);
const shipping = useMemo(() => calculateShipping(
    enriched.map(i => ({ quantity: i.quantity, weightGrams: i.weightGrams })),
    { country }
  ), [enriched, country]);  const postageCost = shipping.postageCost ?? 0;
  const handlingCharge = shipping.handlingCharge ?? 0;
  const shippingCost = shipping.cost ?? 0; // postage + handling
  const discountAmount = useMemo(() => {
    const rate = discountRate > 1 ? discountRate / 100 : discountRate;
    return +(subtotal * rate).toFixed(2);
  }, [subtotal, discountRate]);
  const estimatedTotal = useMemo(
    () => +(subtotal - discountAmount + shippingCost).toFixed(2),
    [subtotal, discountAmount, shippingCost]
  );

  const handleDownloadInvoice = () => {
    if (!generatedOrderId) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const today = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
    const html = `
<!DOCTYPE html>
<html><head>
<title>Invoice ${generatedOrderId}</title>
<style>
  body { font-family: 'Georgia', serif; padding: 40px; color: #1a1a1a; line-height: 1.5; max-width: 800px; margin: 0 auto; }
  .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
  .brand h1 { font-size: 22px; margin: 0; }
  .brand p { color: #7d5a34; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0; }
  .meta { text-align: right; font-size: 11px; }
  .section { margin: 24px 0; font-family: sans-serif; font-size: 12px; }
  .section h3 { font-family: 'Georgia', serif; font-size: 14px; font-weight: normal; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 30px 0; }
  th { border-bottom: 1px solid #1a1a1a; padding: 10px 8px; text-align: left; font-family: sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  td { padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 13px; }
  .text-right { text-align: right; }
  .totals { margin-top: 20px; font-family: sans-serif; font-size: 12px; }
  .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals-row.final { border-top: 2px solid #1a1a1a; margin-top: 8px; padding-top: 12px; font-weight: bold; font-size: 15px; }
  .status { background: #f3ede4; color: #7d5a34; padding: 8px 12px; border: 1px solid #7d5a34; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; text-align: center; margin: 20px 0; }
  .footer { border-top: 1px dashed #ccc; padding-top: 20px; margin-top: 40px; font-size: 10px; font-style: italic; color: #666; text-align: center; }
  @media print { .no-print { display: none; } }
</style>
</head><body>
  <div class="header">
    <div class="brand">
      <h1>Idarah-i Adabiyat-i Dilli</h1>
      <p>Associated with Jayyad Press</p>
    </div>
    <div class="meta">
      <div><strong>Order ID:</strong> ${generatedOrderId}</div>
      <div><strong>Date:</strong> ${today}</div>
    </div>
  </div>

  <div class="status">Paid · Tax Invoice</div>

  <div class="section">
    <h3>Customer</h3>
    <div><strong>${customerName}</strong></div>
    <div>${customerPhone}</div>
    ${customerEmail ? `<div>${customerEmail}</div>` : ''}
  </div>

  <div class="section">
    <h3>Shipping Address</h3>
    <div>${addressLine1}${addressLine2 ? ', ' + addressLine2 : ''}</div>
    <div>${city}${state ? ', ' + state : ''} ${postalCode}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Book</th>
        <th class="text-right">Price</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${cart.map(item => `
        <tr>
          <td><strong>${item.title}</strong>${item.author ? `<br/><small style="color:#666">By ${item.author}</small>` : ''}</td>
          <td class="text-right">₹${item.price}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">₹${item.price * item.quantity}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>₹${subtotal}</span></div>
    ${discountAmount > 0 ? `<div class="totals-row" style="color:#7d5a34"><span>Discount (${discountRate}%)</span><span>-₹${discountAmount}</span></div>` : ''}
    <div class="totals-row"><span>Shipping (India Post — Gyan Post, ${shipping.totalWeight}g)</span><span>₹${postageCost}</span></div>
    <div class="totals-row"><span>Handling &amp; Packaging</span><span>₹${handlingCharge}</span></div>
    <div class="totals-row final"><span>Total Paid</span><span>₹${paidAmount}</span></div>
  </div>

  <div class="footer">
    Payment received via Razorpay. Shipping via India Post Gyan Post.
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body></html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleOpenWhatsApp = () => {
    if (!generatedOrderId) return;
    const message = `Assalamu Alaikum.\n\nI have placed and paid for Order #${generatedOrderId} through the website.\n\nName: ${customerName}\n\nPlease confirm dispatch details.\n\nThank you.`;
    window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`, '_blank');
  };

  const handlePaid = (orderId: string) => {
    setGeneratedOrderId(orderId);
    setPaidAmount(estimatedTotal);
    setOrderComplete(true);
    clearCart();
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center font-sans">
        <p className="text-xs uppercase tracking-widest text-[#1A1A1A]/40 animate-pulse">Preparing checkout…</p>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] px-6 py-20 flex items-center justify-center font-sans">
        <div className="max-w-md w-full bg-white border border-[#1A1A1A]/10 p-8 text-center shadow-sm rounded-sm">
          <div className="w-12 h-12 bg-[#7D5A34]/10 text-[#7D5A34] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <span className="font-sans text-[9px] uppercase tracking-[0.25em] font-bold text-[#7D5A34] block mb-1">Payment Successful</span>
          <h2 className="font-serif text-2xl font-normal mb-2">Order Confirmed</h2>
          <p className="text-xs font-mono tracking-widest text-[#1A1A1A]/70 mb-6">{generatedOrderId}</p>
          <p className="text-xs text-[#1A1A1A]/60 leading-relaxed mb-6">
            Your payment of ₹{paidAmount.toFixed(2)} has been received. Your order is now confirmed and will be packed and dispatched shortly.
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={handleDownloadInvoice} className="w-full flex items-center justify-center gap-2 bg-[#7D5A34]/5 border border-[#7D5A34]/30 text-[#7D5A34] text-xs font-bold uppercase tracking-widest py-3 hover:bg-[#7D5A34]/10 transition-colors">
              <Download className="w-3.5 h-3.5" /> Download Invoice
            </button>
            <button onClick={handleOpenWhatsApp} className="w-full flex items-center justify-center gap-2 bg-[#1A1A1A] hover:bg-[#7D5A34] text-white text-xs font-bold uppercase tracking-widest py-4 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" /> Notify via WhatsApp
            </button>
            <button onClick={() => router.push('/')} className="w-full mt-2 flex items-center justify-center gap-2 border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs font-bold uppercase tracking-widest py-3 hover:bg-[#1A1A1A]/5 transition-colors">
              <Home className="w-3.5 h-3.5" /> Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Shared row typography — every summary line uses this so Subtotal, Shipping,
  // Handling, Discount, and Total share one hierarchy.
  const rowClass = "flex justify-between items-baseline text-xs font-sans text-[#1A1A1A]/80";
  const rowLabelClass = "uppercase tracking-wider";
  const rowValueClass = "font-semibold tabular-nums";

  // Address object passed to the checkout API.
  const addressPayload = {
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] px-6 py-12 md:py-16 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <button onClick={() => router.push('/books')} className="text-xs uppercase tracking-widest font-bold bg-white border border-[#1A1A1A]/20 px-4 py-2.5 rounded-sm hover:bg-[#1A1A1A]/5 transition-colors">
            ← Back to Catalog
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          <div className="lg:col-span-7">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="w-4 h-4 text-[#7D5A34]" strokeWidth={1.5} />
              <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-[#7D5A34]">Checkout</span>
            </div>
            <h2 className="font-serif text-3xl font-normal mb-1">Complete Your Order</h2>
            <p className="text-xs text-[#1A1A1A]/60 tracking-widest uppercase mb-8">Pay securely — order confirmed instantly</p>

            {cart.length === 0 ? (
              <div className="border border-dashed border-[#1A1A1A]/10 bg-white p-12 text-center rounded-sm">
                <p className="text-xs italic text-[#1A1A1A]/50 mb-3">Your cart is empty.</p>
                <a href="/books" className="text-[10px] font-bold uppercase tracking-widest text-[#7D5A34] hover:underline">Browse catalog →</a>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Full Name *</label>
                  <input required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none rounded-sm" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Phone *</label>
                    <input type="tel" required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+91" className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none rounded-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Email</label>
                    <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none rounded-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Address Line 1 *</label>
                  <input required value={addressLine1} onChange={e => setAddressLine1(e.target.value)} className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none rounded-sm" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Address Line 2</label>
                  <input value={addressLine2} onChange={e => setAddressLine2(e.target.value)} className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none rounded-sm" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">City *</label>
                    <input required value={city} onChange={e => setCity(e.target.value)} className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none rounded-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">State</label>
                    <input value={state} onChange={e => setState(e.target.value)} className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none rounded-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">PIN Code *</label>
                    <input required value={postalCode} onChange={e => setPostalCode(e.target.value)} className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none rounded-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Country *</label>
                  <select
                    required
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none rounded-sm"
                  >
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Place Order & Pay — straight payment, no verification gate */}
                <PayButton
                  items={cart.map(i => ({ bookId: i.id, quantity: i.quantity }))}
                  address={addressPayload}
                  customerName={customerName}
                  customerPhone={customerPhone}
                  customerEmail={customerEmail}
                  user={{ name: user?.displayName || '', email: user?.email || '' }}
                  idToken={idToken}
                  totalRupees={estimatedTotal}
                  disabled={shipping.requiresQuote || !idToken}
                  onPaid={handlePaid}
                />

                {!idToken && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-sm">
                    Refreshing your session… if this persists, please log in again.
                  </p>
                )}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="lg:col-span-5">
              <div className="bg-white border border-[#1A1A1A]/10 p-6 rounded-sm shadow-sm sticky top-[140px]">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-4 h-4 text-[#7D5A34]" strokeWidth={1.5} />
                  <h3 className="font-serif text-lg">Order Summary</h3>
                </div>

                <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1 border-b border-[#1A1A1A]/5 pb-4">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <div>
                        <p className="font-serif font-bold">{item.title}</p>
                        <p className="text-[10px] text-[#1A1A1A]/50">Qty {item.quantity} × ₹{item.price}</p>
                      </div>
                      <span className="font-semibold">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Uniform typography for every summary line */}
                <div className="mt-4 space-y-2">
                  <div className={rowClass}>
                    <span className={rowLabelClass}>Subtotal</span>
                    <span className={rowValueClass}>₹{subtotal}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className={`${rowClass} text-[#7D5A34]`}>
                      <span className={rowLabelClass}>Discount ({discountRate}%)</span>
                      <span className={rowValueClass}>-₹{discountAmount}</span>
                    </div>
                  )}

                  <div className={rowClass}>
                    <span className={rowLabelClass}>
                      Shipping{shipping.tier?.label ? ` — ${shipping.tier.label}` : ''}
                    </span>
                    <span className={rowValueClass}>
                      {shipping.postageCost != null ? `₹${postageCost}` : 'Quote'}
                    </span>
                  </div>

                  {!shipping.requiresQuote && handlingCharge > 0 && (
                    <div className={rowClass}>
                      <span className={rowLabelClass}>Handling &amp; Packaging</span>
                      <span className={rowValueClass}>₹{handlingCharge}</span>
                    </div>
                  )}

                  <div className={`${rowClass} text-[#1A1A1A]/50`}>
                    <span className={rowLabelClass}>Weight (incl. {PACKAGING_WEIGHT_GRAMS}g pkg)</span>
                    <span className={rowValueClass}>{shipping.totalWeight} g</span>
                  </div>

                  {shipping.requiresQuote && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm text-[11px] text-amber-800 leading-relaxed mt-2 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {shipping.message}
                    </div>
                  )}
                </div>

                <div className={`${rowClass} mt-4 pt-4 border-t-2 border-[#1A1A1A] text-[#1A1A1A] text-base`}>
                  <span className="uppercase tracking-wider font-bold">Total</span>
                  <span className="font-bold tabular-nums">
                    {shipping.requiresQuote ? '—' : `₹${estimatedTotal}`}
                  </span>
                </div>
                 {country !== 'India' && (
                  <p className="text-[9px] italic text-[#1A1A1A]/40 mt-2">
                    International delivery via India Post Speed Post. Customs duties, if any, are payable by the receiver.
                  </p>
                )}
                <p className="text-[9px] italic text-[#1A1A1A]/40 mt-2 text-right">Final amount charged on payment.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
