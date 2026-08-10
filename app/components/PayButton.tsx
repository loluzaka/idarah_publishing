"use client";

import { useState } from "react";

// Razorpay's checkout script is loaded globally (see SETUP.md — add the
// <Script> tag in app/layout.tsx). We declare the global here for TS.
declare global {
  interface Window {
    Razorpay: any;
  }
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
  disabled?: boolean;
  onPaid?: (orderId: string) => void;
  onError?: (message: string) => void;
}

// The single "Place Order & Pay" button used at checkout.
// It creates the order + Razorpay order on the server, opens the Razorpay
// checkout modal on THIS page, then verifies the payment server-side.
export default function PayButton({
  items,
  address,
  customerName,
  customerPhone,
  customerEmail,
  user,
  idToken,
  totalRupees,
  disabled,
  onPaid,
  onError,
}: PayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function placeOrderAndPay() {
    setError(null);
    if (!customerName.trim() || !customerPhone.trim()) {
      const msg = "Please fill in name and phone.";
      setError(msg);
      onError?.(msg);
      return;
    }
    if (!address.addressLine1?.trim() || !address.city?.trim() || !address.postalCode?.trim()) {
      const msg = "Please fill in address, city, and postal code.";
      setError(msg);
      onError?.(msg);
      return;
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
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not start checkout");
      }
      const { orderId, displayOrderId, razorpayOrderId, amount } = await res.json();

      // 2. Open Razorpay Checkout on this page (no redirect away).
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount, // paise
        currency: "INR",
        name: "Idarah Publishing",
        description: "Book order",
        order_id: razorpayOrderId,
        prefill: {
          name: customerName || user.name || "",
          email: customerEmail || user.email || "",
          contact: customerPhone || user.phone || "",
        },
        theme: { color: "#1A1A1A" }, // match your scholarly palette
        handler: async (response: any) => {
          // 3. Verify the signature server-side and mark the order Paid.
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
            const msg =
              "Verification failed. If money was debited, the webhook will confirm it shortly.";
            setError(msg);
            onError?.(msg);
          }
        },
      });

      rzp.on("payment.failed", (resp: any) => {
        const msg = resp?.error?.description || "Payment failed";
        setError(msg);
        onError?.(msg);
      });

      rzp.open();
    } catch (e: any) {
      const msg = e?.message || "Something went wrong";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={placeOrderAndPay}
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
      <p className="text-[10px] text-[#1A1A1A]/50 italic text-center leading-relaxed mt-3">
        You will be charged now via Razorpay. Your order is confirmed instantly on successful payment.
      </p>
    </div>
  );
}
