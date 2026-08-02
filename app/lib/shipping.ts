// India Post — Gyan Post shipping rate calculator.
// Rates are weight-based, distance-independent.

export interface ShippingRate {
  /** Tier upper bound in grams (inclusive). Infinity means "over the max". */
  maxWeightGrams: number;
  /** Cost in rupees. null means "contact for a quote". */
  cost: number | null;
  label: string;
}

// Configurable packaging weight added to the sum of book weights.
export const PACKAGING_WEIGHT_GRAMS = 150;

// Flat handling & packaging fee (₹) added on top of postal freight.
// Adjust here to change site-wide.
export const HANDLING_CHARGE = 20;

// Weight tiers — modify here to update rates site-wide.
export const GYAN_POST_TIERS: ShippingRate[] = [
  { maxWeightGrams: 300,      cost: 20,   label: 'Up to 300 g' },
  { maxWeightGrams: 500,      cost: 30,   label: '301–500 g' },
  { maxWeightGrams: 1000,     cost: 50,   label: '501 g – 1 kg' },
  { maxWeightGrams: 2000,     cost: 65,   label: '1–2 kg' },
  { maxWeightGrams: 3000,     cost: 80,   label: '2–3 kg' },
  { maxWeightGrams: 4000,     cost: 100,  label: '3–4 kg' },
  { maxWeightGrams: 5000,     cost: 120,  label: '4–5 kg' },
  { maxWeightGrams: Infinity, cost: null, label: 'Over 5 kg' },
];

export interface ShippingCalc {
  bookWeight: number;
  packagingWeight: number;
  totalWeight: number;
  /** Postal freight only, in rupees. null when parcel exceeds Gyan Post's 5kg limit. */
  postageCost: number | null;
  /** Flat handling & packaging fee in rupees. 0 when requiresQuote. */
  handlingCharge: number;
  /** postageCost + handlingCharge. null when requiresQuote. */
  cost: number | null;
  tier: ShippingRate | null;
  requiresQuote: boolean;
  message?: string;
}

export interface CartItemWithWeight {
  quantity: number;
  weightGrams?: number | null;
}

/**
 * Compute shipping for a set of items whose weight is known.
 * Items without a weight contribute 0g (safest fallback — admin can add weights later).
 */
export function calculateShipping(items: CartItemWithWeight[], packagingWeight = PACKAGING_WEIGHT_GRAMS): ShippingCalc {
  const bookWeight = items.reduce((sum, i) => {
    const w = Number(i.weightGrams) || 0;
    const q = Number(i.quantity) || 0;
    return sum + w * q;
  }, 0);

  const totalWeight = bookWeight + packagingWeight;
  const tier = GYAN_POST_TIERS.find(t => totalWeight <= t.maxWeightGrams) ?? null;
  const postageCost = tier?.cost ?? null;
  const requiresQuote = postageCost == null;
  const handlingCharge = requiresQuote ? 0 : HANDLING_CHARGE;
  const cost = requiresQuote ? null : (postageCost as number) + handlingCharge;

  return {
    bookWeight,
    packagingWeight,
    totalWeight,
    postageCost,
    handlingCharge,
    cost,
    tier,
    requiresQuote,
    message: requiresQuote
      ? 'Please contact us for institutional or bulk shipping.'
      : undefined,
  };
}
