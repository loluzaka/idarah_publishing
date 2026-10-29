import { NextResponse } from "next/server";

// Razorpay Magic Checkout → "URL for Get Promotions"
// Dashboard → Magic Checkout → Checkout Settings → Coupon Settings →
//   https://<your-domain>/api/magic-checkout/promotions
//
// Razorpay calls this (unauthenticated, per their contract) to list the
// promotions available for an order. There is no coupon system: member
// discounts are applied up front when the order is created, so the list is
// always empty. The route exists because the dashboard requires the URL.
// The docs list the method as GET but describe a JSON body, so both work.
async function handle() {
  return NextResponse.json({ promotions: [] }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
