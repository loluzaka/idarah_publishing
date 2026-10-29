"use client";

import { useRef, useState } from "react";

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error?: { description?: string };
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (resp: RazorpayFailure) => void): void;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

// Both scripts define window.Razorpay, so only one may be "live" at a time.
// They're loaded on demand (not in layout.tsx) so a late-loading script can
// never overwrite the one the current payment needs. Re-injecting a script
// re-runs it, which is how we switch back to Standard for the fallback.
type Variant = "magic" | "standard";
const SCRIPT_SRC: Record<Variant, string> = {
  magic: "https://checkout.razorpay.com/v1/magic-checkout.js",
  standard: "https://checkout.razorpay.com/v1/checkout.js",
};
let liveVariant: Variant | null = null;

function loadRazorpay(variant: Variant, timeoutMs = 10_000): Promise<void> {
  if (liveVariant === variant && window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC[variant];
    s.async = true;
    const timer = setTimeout(() => {
      s.remove();
      reject(new Error(`${variant} checkout timed out`));
    }, timeoutMs);
    s.onload = () => {
      clearTimeout(timer);
      liveVariant = variant;
      resolve();
    };
    s.onerror = () => {
      clearTimeout(timer);
      s.remove();
      reject(new Error(`${variant} checkout failed to load`));
    };
    document.head.appendChild(s);
  });
}

interface CartItem {
  bookId: string;
  quantity: number;
}

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

interface PayUser {
  name?: string;
  email?: string;
  phone?: string;
}

interface PayButtonProps {
  items: CartItem[];
  address: AddressInput;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  user: PayUser;
  idToken: string; // Firebase ID token — get via await user.getIdToken()
  totalRupees: number; // shown on the button label (server amount is authoritative)
  /** Indian order with Magic Checkout enabled: Razorpay collects the address. */
  magicMode?: boolean;
  disabled?: boolean;
  onPaid?: (orderId: string) => void;
  onError?: (message: string) => void;
}

// The single "Place Order & Pay" button used at checkout.
//
// PRIMARY  — Razorpay Magic Checkout (Indian orders, when enabled): address,
//            coupons and shipping are handled inside Razorpay's modal.
// FALLBACK — the standard Razorpay modal with our own address form. Used
//            automatically when Magic can't be started (server-side or the
//            script won't load), on demand via the link shown after a Magic
//            error, and always for international orders.
export default function PayButton({
  items,
  address,
  customerName,
  customerPhone,
  customerEmail,
  user,
  idToken,
  totalRupees,
  magicMode = false,
  disabled,
  onPaid,
  onError,
}: PayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canFallback, setCanFallback] = useState(false);
  // Firestore order from the previous attempt — reused on a retry/fallback so
  // no orphaned pending_payment orders are left behind.
  const pendingOrderId = useRef<string | null>(null);

  function fail(msg: string) {
    setError(msg);
    onError?.(msg);
  }

  async function placeOrderAndPay(forceStandard = false) {
    setError(null);
    const useMagic = magicMode && !forceStandard;

    // Magic collects name/phone/address itself; everything else needs them here.
    if (!useMagic) {
      if (!customerName.trim() || !customerPhone.trim()) {
        return fail("Please fill in name and phone.");
      }
      if (!address.addressLine1?.trim() || !address.city?.trim() || !address.postalCode?.trim()) {
        return fail("Please fill in address, city, and postal code.");
      }
    }

    setLoading(true);
    try {
      // 1. Create the order + Razorpay order on the server.
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          items,
          address,
          customerName,
          customerPhone,
          customerEmail,
          checkoutMode: useMagic ? "auto" : "standard",
          ...(pendingOrderId.current ? { orderId: pendingOrderId.current } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not start checkout");
      }
      const { orderId, displayOrderId, razorpayOrderId, amount, checkoutType, discountPaise } =
        await res.json();

      // 2. Load the right Razorpay script. If Magic's won't load, fall back now.
      pendingOrderId.current = orderId;
      const isMagic = checkoutType === "magic";
      if (isMagic) {
        try {
          await loadRazorpay("magic");
        } catch (e) {
          console.warn("[PayButton] Magic Checkout unavailable, using standard:", e);
          setLoading(false);
          return placeOrderAndPay(true);
        }
      } else {
        await loadRazorpay("standard");
      }

      // 3. Open Razorpay Checkout on this page (no redirect away).
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount, // paise
        currency: "INR",
        name: "Idarah Publishing",
        description: "Book order",
        order_id: razorpayOrderId,
        ...(isMagic
          ? { one_click_checkout: true, show_coupons: true }
          : {}),
        prefill: {
          name: customerName || user.name || "",
          email: customerEmail || user.email || "",
          contact: customerPhone || user.phone || "",
          // Display-only: shows the member discount that is already in `amount`.
          ...(isMagic && discountPaise > 0
            ? { prediscount: [{ label: "Member discount", value: `₹${(discountPaise / 100).toFixed(2)}` }] }
            : {}),
        },
        theme: { color: "#1A1A1A" }, // match your scholarly palette
        handler: async (response: RazorpaySuccess) => {
          // 4. Verify the signature server-side and mark the order Paid.
          const v = await fetch("/api/payments/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId,
            }),
          });
          if (v.ok) {
            onPaid?.(displayOrderId ?? orderId);
          } else {
            fail("Verification failed. If money was debited, the webhook will confirm it shortly.");
          }
        },
      });

      rzp.on("payment.failed", (resp) => {
        fail(resp?.error?.description || "Payment failed");
        if (isMagic) setCanFallback(true);
      });

      rzp.open();
      setCanFallback(isMagic);
    } catch (e) {
      fail(e instanceof Error && e.message ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => placeOrderAndPay()}
        disabled={disabled || loading}
        aria-label="Place order and pay with Razorpay"
        className="w-full bg-[#1A1A1A] hover:bg-[#7D5A34] text-white text-xs font-bold uppercase tracking-widest py-4 transition-colors rounded-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? "Processing…" : `Place Order & Pay ₹${totalRupees.toFixed(2)}`}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-700 bg-red-50 border-l-2 border-red-500 p-3 rounded-sm leading-relaxed">
          {error}
        </p>
      )}
      {magicMode && canFallback && (
        <button
          type="button"
          onClick={() => placeOrderAndPay(true)}
          disabled={disabled || loading}
          className="mt-3 w-full text-[10px] font-bold uppercase tracking-widest text-[#7D5A34] underline underline-offset-4 disabled:opacity-40"
        >
          Trouble paying? Use standard checkout instead
        </button>
      )}
      <p className="text-[10px] text-[#1A1A1A]/50 italic text-center leading-relaxed mt-3">
        {magicMode
          ? "Secure one-tap checkout by Razorpay — your delivery address is collected in the next step. Your order is confirmed instantly on successful payment."
          : "You will be charged now via Razorpay. Your order is confirmed instantly on successful payment."}
      </p>
    </div>
  );
}
