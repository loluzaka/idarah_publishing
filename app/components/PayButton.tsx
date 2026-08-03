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

interface PayUser {
  name?: string;
  email?: string;
  phone?: string;
}

interface PayButtonProps {
  items: CartItem[];
  addressId: string;
  user: PayUser;
  idToken: string; // Firebase ID token — get via await user.getIdToken()
  disabled?: boolean;
  onPaid?: (orderId: string) => void;
  onError?: (message: string) => void;
}

// The single "Place Order & Pay" button used at checkout.
// It creates the order + Razorpay order on the server, opens the Razorpay
// checkout modal on THIS page, then verifies the payment server-side.
export default function PayButton({
  items,
  addressId,
  user,
  idToken,
  disabled,
  onPaid,
  onError,
}: PayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function placeOrderAndPay() {
    setError(null);
    if (!addressId) {
      const msg = "Please select a shipping address.";
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
        body: JSON.stringify({ items, addressId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not start checkout");
      }
      const { orderId, razorpayOrderId, amount } = await res.json();

      // 2. Open Razorpay Checkout on this page (no redirect away).
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount, // paise
        currency: "INR",
        name: "Idarah Publishing",
        description: "Book order",
        order_id: razorpayOrderId,
        prefill: {
          name: user.name || "",
          email: user.email || "",
          contact: user.phone || "",
        },
        theme: { color: "#1f2937" }, // match your scholarly palette
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
            onPaid?.(orderId);
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
        className="inline-flex w-full items-center justify-center rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Starting…" : "Place Order & Pay"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
