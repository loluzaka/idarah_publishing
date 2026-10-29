import { NextResponse } from "next/server";

// Razorpay Magic Checkout → "URL for Apply Promotion"
// Dashboard → Magic Checkout → Checkout Settings → Coupon Settings →
//   https://<your-domain>/api/magic-checkout/promotions/apply
//
// Razorpay calls this (unauthenticated, per their contract) when the customer
// enters a code. There are no promotion codes, so every code is rejected with
// the documented failure shape. The route exists because the dashboard
// requires the URL; add real validation here if coupons are ever introduced.
async function handle() {
  return NextResponse.json(
    {
      failure_code: "INVALID_PROMOTION",
      failure_reason: "This promotion code is not valid.",
    },
    { status: 400, headers: { "Cache-Control": "no-store" } }
  );
}

export const GET = handle;
export const POST = handle;
