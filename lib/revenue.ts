import type { RevenueEstimate, TrafficEstimate } from './types';

/**
 * Store revenue isn't exposed by Shopify's public products.json, and real
 * traffic/revenue figures require a paid provider (Store Leads, Koala
 * Inspector, SimilarWeb). This produces a *range*, never a single number,
 * using the traffic (visitors) × conversion-rate range × AOV model — and
 * caps confidence at 'medium' even in the best case, since the traffic
 * input is a Tranco-rank tier, not measured traffic.
 *
 * To swap in a real provider later: implement a lookup here keyed by
 * domain (e.g. behind a REVENUE_PROVIDER_API_KEY env var) and return it in
 * this same {low, base, high, confidence, method} shape — the rest of the
 * app doesn't care where the numbers came from.
 */
export type RevenueContext = {
  traffic: TrafficEstimate | null;
  avgPrice: number | null;
  catalogSize: number;
};

const CONVERSION_LOW = 0.01;
const CONVERSION_BASE = 0.02;
const CONVERSION_HIGH = 0.03;

// Only used with zero traffic signal (no Tranco rank at all) — a much
// weaker last-resort proxy so a store still shows something rather than
// nothing. Always 'low' confidence.
const ASSUMED_UNITS_SOLD_PER_SKU_PER_MONTH = 8;

export function estimateMonthlyRevenue(context: RevenueContext): RevenueEstimate | null {
  const { traffic, avgPrice, catalogSize } = context;

  if (traffic && avgPrice !== null) {
    const visitsHigh = traffic.monthlyVisitsHigh ?? traffic.monthlyVisitsLow * 3;
    const visitsMid = (traffic.monthlyVisitsLow + visitsHigh) / 2;

    return {
      low: traffic.monthlyVisitsLow * CONVERSION_LOW * avgPrice,
      base: visitsMid * CONVERSION_BASE * avgPrice,
      high: visitsHigh * CONVERSION_HIGH * avgPrice,
      confidence: 'medium',
      method: 'Estimated visits (Tranco rank tier) × 1–3% conversion range × avg. relevant-product price',
    };
  }

  if (avgPrice !== null && catalogSize > 0) {
    const base = avgPrice * catalogSize * ASSUMED_UNITS_SOLD_PER_SKU_PER_MONTH;
    return {
      low: base * 0.4,
      base,
      high: base * 2,
      confidence: 'low',
      method: 'Catalog size × avg. price × assumed sell-through (no traffic signal available)',
    };
  }

  return null;
}
