// Central pricing engine — computes the final customer price from
// (base Sanity price) + (user's discount rate) + (future promotional rules).
//
// Sanity book prices are NEVER modified. This function is the ONLY place
// where the customer-facing price is computed. Use it everywhere: cards,
// modal, cart, checkout, order summary.

export interface PricingInput {
  basePrice: number;              // Sanity `price` (₹)
  baseOriginalPrice?: number | null; // Sanity `originalPrice` — MSRP / MRP if set
  discountRate?: number | null;   // 0-100, from user's Firestore profile
  // Reserved for future extensions — the API accepts them today so callers
  // don't need to change when we add coupons / campaigns / bulk pricing.
  couponPercent?: number | null;
  couponFixed?: number | null;
  campaignPercent?: number | null;
  bulkDiscountPercent?: number | null;
}

export interface PricingResult {
  /** Final price the customer actually pays (₹, rounded to whole rupees). */
  finalPrice: number;
  /** The base Sanity selling price, unmodified. */
  basePrice: number;
  /** Struck-through comparison price — max of originalPrice and basePrice. */
  originalPrice: number | null;
  /** Whether the final price is below the original (show strike-through UI). */
  isDiscounted: boolean;
  /** How much the customer saves off the original, in ₹. */
  savings: number;
  /** Effective discount percentage from originalPrice to finalPrice. */
  effectiveDiscountPercent: number;
  /** Breakdown for debugging / receipts. */
  breakdown: {
    userTierDiscount: number;
    couponDiscount: number;
    campaignDiscount: number;
    bulkDiscount: number;
  };
}

function clampPercent(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * Compute the final customer price. Combines rules multiplicatively so stacking
 * discounts never yields a negative price. Rules currently applied:
 *   1. User tier discount    (from Firestore profile)
 *   2. Coupon code           (reserved, unused today)
 *   3. Campaign discount     (reserved, unused today)
 *   4. Bulk order discount   (reserved, unused today)
 */
export function computePrice(input: PricingInput): PricingResult {
  const base = Math.max(0, Number(input.basePrice) || 0);
  const userTier    = clampPercent(input.discountRate);
  const coupon      = clampPercent(input.couponPercent);
  const campaign    = clampPercent(input.campaignPercent);
  const bulk        = clampPercent(input.bulkDiscountPercent);
  const couponFixed = Math.max(0, Number(input.couponFixed) || 0);

  // Apply percentage discounts multiplicatively (best user experience — no
  // silly "over 100%" stacking).
  const multiplier =
    (1 - userTier / 100) *
    (1 - coupon / 100) *
    (1 - campaign / 100) *
    (1 - bulk / 100);

  const afterPercent = base * multiplier;
  const finalPrice = Math.max(0, Math.round(afterPercent - couponFixed));

  // For UI strike-through, compare against whichever is HIGHER:
  //  – the Sanity MRP (originalPrice) when the book is already discounted, or
  //  – the base selling price when the user is getting a tier discount off the shelf price.
  const originalCandidate = Math.max(base, Number(input.baseOriginalPrice) || 0);
  const isDiscounted = finalPrice < originalCandidate;
  const savings = isDiscounted ? originalCandidate - finalPrice : 0;
  const effectiveDiscountPercent = originalCandidate > 0 && isDiscounted
    ? Math.round((savings / originalCandidate) * 100)
    : 0;

  return {
    finalPrice,
    basePrice: base,
    originalPrice: isDiscounted ? originalCandidate : null,
    isDiscounted,
    savings,
    effectiveDiscountPercent,
    breakdown: {
      userTierDiscount: userTier,
      couponDiscount: coupon,
      campaignDiscount: campaign,
      bulkDiscount: bulk,
    },
  };
}

/** Convenience wrapper for the common case (base + user tier only). */
export function customerPrice(basePrice: number, originalPrice: number | null | undefined, discountRate: number | null | undefined): PricingResult {
  return computePrice({ basePrice, baseOriginalPrice: originalPrice ?? null, discountRate: discountRate ?? 0 });
}
