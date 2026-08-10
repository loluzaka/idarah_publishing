// India Post — shipping rate calculators.
// Domestic:      Gyan Post (weight-based, distance-independent).
// International: India Post International Speed Post / EMS — weight-based, zone-based.
//
// ⚠️ Rates are tuned to researched international shipping figures (economy-to-
// postal range, ~₹600–1,400 for 0.5–1kg; ~₹850–1,100/kg for heavy shipments).
// VERIFY with your post office / courier before going live, then edit the numbers.

export interface ShippingRate {
  /** Tier upper bound in grams (inclusive). Infinity means "over the max". */
  maxWeightGrams: number;
  /** Cost in rupees. null means "contact for a quote". */
  cost: number | null;
  label: string;
}

// Configurable packaging weight added to the sum of book weights.
export const PACKAGING_WEIGHT_GRAMS = 150;

// Flat handling & packaging fee (₹) on top of postal freight.
export const HANDLING_CHARGE = 20;
// Slightly higher handling for international parcels (customs forms, sturdier packing).
export const INTERNATIONAL_HANDLING_CHARGE = 30;

// ─── Domestic tiers (unchanged) ──────────────────────────────────────────────
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

// ─── International zones ──────────────────────────────────────────────────────
export interface ShippingZone {
  id: string;
  label: string;
  countries: string[]; // lowercased; see COUNTRY_ALIASES for common spellings
  tiers: ShippingRate[];
  /**
   * Per extra kg (₹) above the last finite tier — heavy/bulk orders.
   * null means any weight past the last tier requires a manual quote.
   */
  extraKgRate?: number;
  /** Upper bound (grams) for the extra-kg pricing. Beyond → requiresQuote. */
  extraKgMaxGrams?: number;
}

export const INTERNATIONAL_ZONES: ShippingZone[] = [
  {
    id: 'zone1',
    label: 'Zone 1 — SAARC & Neighbours',
    countries: ['pakistan', 'nepal', 'bangladesh', 'sri lanka', 'bhutan', 'afghanistan', 'maldives'],
    tiers: [
      { maxWeightGrams: 100,  cost: 450,  label: 'Up to 100 g' },
      { maxWeightGrams: 250,  cost: 700,  label: '101–250 g' },
      { maxWeightGrams: 500,  cost: 1000, label: '251–500 g' },
      { maxWeightGrams: 1000, cost: 1400, label: '501 g – 1 kg' },
      { maxWeightGrams: 2000, cost: 2400, label: '1–2 kg' },
      { maxWeightGrams: 3000, cost: 3200, label: '2–3 kg' },
      { maxWeightGrams: 5000, cost: 4800, label: '3–5 kg' },
    ],
    extraKgRate: 850,
    extraKgMaxGrams: 20_000,
  },
  {
    id: 'zone2',
    label: 'Zone 2 — Middle East & Asia',
    countries: [
      'united arab emirates', 'saudi arabia', 'qatar', 'oman', 'kuwait', 'bahrain',
      'jordan', 'iraq', 'iran', 'turkey', 'lebanon', 'syria',
      'malaysia', 'indonesia', 'singapore', 'thailand', 'china', 'hong kong', 'japan',
      'south korea', 'vietnam', 'philippines', 'taiwan',
    ],
    tiers: [
      { maxWeightGrams: 100,  cost: 550,  label: 'Up to 100 g' },
      { maxWeightGrams: 250,  cost: 820,  label: '101–250 g' },
      { maxWeightGrams: 500,  cost: 1150, label: '251–500 g' },
      { maxWeightGrams: 1000, cost: 1600, label: '501 g – 1 kg' },
      { maxWeightGrams: 2000, cost: 2700, label: '1–2 kg' },
      { maxWeightGrams: 3000, cost: 3600, label: '2–3 kg' },
      { maxWeightGrams: 5000, cost: 5400, label: '3–5 kg' },
    ],
    extraKgRate: 950,
    extraKgMaxGrams: 20_000,
  },
  {
    id: 'zone3',
    label: 'Zone 3 — Europe, Americas, Africa & Rest',
    countries: [
      'united states', 'canada', 'mexico', 'united kingdom', 'ireland',
      'germany', 'france', 'italy', 'spain', 'portugal', 'netherlands', 'belgium',
      'switzerland', 'austria', 'sweden', 'norway', 'denmark', 'poland', 'greece',
      'australia', 'new zealand',
      'south africa', 'nigeria', 'egypt', 'kenya', 'morocco', 'ethiopia',
      'brazil', 'argentina', 'chile',
    ],
    tiers: [
      { maxWeightGrams: 100,  cost: 650,  label: 'Up to 100 g' },
      { maxWeightGrams: 250,  cost: 960,  label: '101–250 g' },
      { maxWeightGrams: 500,  cost: 1350, label: '251–500 g' },
      { maxWeightGrams: 1000, cost: 1900, label: '501 g – 1 kg' },
      { maxWeightGrams: 2000, cost: 3200, label: '1–2 kg' },
      { maxWeightGrams: 3000, cost: 4300, label: '2–3 kg' },
      { maxWeightGrams: 5000, cost: 6400, label: '3–5 kg' },
    ],
    extraKgRate: 1100,
    extraKgMaxGrams: 20_000,
  },
];

// Any country not in a zone above falls into this one ("rest of world").
export const REST_OF_WORLD_ZONE: ShippingZone = {
  id: 'world',
  label: 'Rest of the World',
  countries: [],
  tiers: INTERNATIONAL_ZONES[2].tiers, // same as zone 3
  extraKgRate: INTERNATIONAL_ZONES[2].extraKgRate,
  extraKgMaxGrams: INTERNATIONAL_ZONES[2].extraKgMaxGrams,
};

// Common spellings → canonical country name (lowercased).
const COUNTRY_ALIASES: Record<string, string> = {
  us: 'united states',
  usa: 'united states',
  america: 'united states',
  uk: 'united kingdom',
  england: 'united kingdom',
  uae: 'united arab emirates',
  'u.a.e': 'united arab emirates',
  ksa: 'saudi arabia',
  saudi: 'saudi arabia',
  's.korea': 'south korea',
};

/** Lowercase + alias-normalise a country name for matching. */
export function normalizeCountry(country?: string | null): string {
  const c = (country ?? '').trim().toLowerCase();
  return COUNTRY_ALIASES[c] ?? c;
}

/** True when the country resolves to India (or was left blank). */
export function isIndianCountry(country?: string | null): boolean {
  const c = normalizeCountry(country);
  return c === '' || c === 'india';
}

/** The international zone matching a country, or REST_OF_WORLD_ZONE. */
export function getZoneForCountry(country?: string | null): ShippingZone {
  const c = normalizeCountry(country);
  return (
    INTERNATIONAL_ZONES.find(z => z.countries.includes(c)) ??
    REST_OF_WORLD_ZONE
  );
}

export interface CartItemWithWeight {
  quantity: number;
  weightGrams?: number | null;
}

export interface ShippingOptions {
  country?: string | null;
  packagingWeight?: number;
}

export interface ShippingCalc {
  bookWeight: number;
  packagingWeight: number;
  totalWeight: number;
  /** Postal freight only, in rupees. null when requiresQuote. */
  postageCost: number | null;
  /** Flat handling & packaging fee in rupees. 0 when requiresQuote. */
  handlingCharge: number;
  /** postageCost + handlingCharge. null when requiresQuote. */
  cost: number | null;
  tier: ShippingRate | null;
  requiresQuote: boolean;
  /** Carrier label for the UI, e.g. "India Post — Gyan Post". */
  carrier: string;
  /** International zone used (null for domestic). */
  zone: ShippingZone | null;
  message?: string;
}

/**
 * Compute shipping for a set of items whose weight is known.
 * Defaults to India (domestic Gyan Post) when country is blank/India.
 * Second arg can be a ShippingOptions object or a legacy number (packaging weight).
 */
export function calculateShipping(
  items: CartItemWithWeight[],
  options: ShippingOptions | number = {}
): ShippingCalc {
  const opts: ShippingOptions = typeof options === 'number' ? { packagingWeight: options } : options;
  const country = normalizeCountry(opts.country);
  const isIndia = country === '' || country === 'india';
  const packagingWeight = opts.packagingWeight ?? PACKAGING_WEIGHT_GRAMS;

  const bookWeight = items.reduce((sum, i) => {
    const w = Number(i.weightGrams) || 0;
    const q = Number(i.quantity) || 0;
    return sum + w * q;
  }, 0);

  const totalWeight = bookWeight + packagingWeight;

  if (isIndia) {
    const tier = GYAN_POST_TIERS.find(t => totalWeight <= t.maxWeightGrams) ?? null;
    const postageCost = tier?.cost ?? null;
    const requiresQuote = postageCost == null;
    const handlingCharge = requiresQuote ? 0 : HANDLING_CHARGE;
    return {
      bookWeight,
      packagingWeight,
      totalWeight,
      postageCost,
      handlingCharge,
      cost: postageCost == null ? null : postageCost + handlingCharge,
      tier,
      requiresQuote,
      carrier: 'India Post — Gyan Post',
      zone: null,
      message: requiresQuote
        ? 'Please contact us for institutional or bulk shipping.'
        : undefined,
    };
  }

  // International
  const zone = getZoneForCountry(country);
  const lastFinite = [...zone.tiers].reverse().find(t => t.cost != null);

  let tier: ShippingRate | null = null;
  let postageCost: number | null = null;

  // Bulk pricing: above the last finite tier, price per extra kg up to extraKgMaxGrams.
  if (lastFinite && zone.extraKgRate && totalWeight > lastFinite.maxWeightGrams) {
    const maxKg = zone.extraKgMaxGrams ?? Infinity;
    if (totalWeight <= maxKg) {
      const overKgs = Math.ceil((totalWeight - lastFinite.maxWeightGrams) / 1000);
      postageCost = (lastFinite.cost as number) + overKgs * zone.extraKgRate;
      tier = { maxWeightGrams: Infinity, cost: postageCost, label: `Bulk (${totalWeight}g)` };
    }
  }

  if (tier == null) {
    tier = zone.tiers.find(t => totalWeight <= t.maxWeightGrams) ?? null;
    postageCost = tier?.cost ?? null;
  }

  const requiresQuote = postageCost == null;
  const handlingCharge = requiresQuote ? 0 : INTERNATIONAL_HANDLING_CHARGE;
  return {
    bookWeight,
    packagingWeight,
    totalWeight,
    postageCost,
    handlingCharge,
    cost: postageCost == null ? null : postageCost + handlingCharge,
    tier,
    requiresQuote,
    carrier: 'India Post — International Speed Post',
    zone,
    message: requiresQuote
      ? 'Your order exceeds the international shipping limit. Please contact us via WhatsApp for a courier quote.'
      : undefined,
  };
}
