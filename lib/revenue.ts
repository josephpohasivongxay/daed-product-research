import type { RevenueEstimate } from './types';

/**
 * Store revenue isn't exposed by Shopify's public products.json — real
 * figures require a paid provider (e.g. Store Leads, Koala Inspector,
 * SimilarWeb). This heuristic exists so results can be sorted by "rough
 * size" without paying for one, and is always labeled as an estimate in
 * the UI rather than presented as real data.
 *
 * To swap in a real provider later: implement a lookup here keyed by
 * domain (e.g. behind a REVENUE_PROVIDER_API_KEY env var) and return
 * `{ monthly, source: 'provider' }` when it succeeds, falling back to
 * this heuristic when it doesn't.
 */
const ASSUMED_UNITS_SOLD_PER_SKU_PER_MONTH = 8;

export function estimateMonthlyRevenue(
  avgPrice: number | null,
  catalogSize: number
): RevenueEstimate | null {
  if (avgPrice === null || catalogSize === 0) return null;

  const monthly = avgPrice * catalogSize * ASSUMED_UNITS_SOLD_PER_SKU_PER_MONTH;
  return { monthly, source: 'heuristic' };
}
