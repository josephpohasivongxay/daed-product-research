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

export type RevenueContext = {
  trancoRank?: number | null;
  domainAgeMonths?: number | null;
};

function popularityMultiplier(trancoRank: number | null | undefined): number {
  if (trancoRank == null) return 1;
  if (trancoRank <= 100_000) return 3;
  if (trancoRank <= 500_000) return 1.5;
  return 1;
}

function maturityMultiplier(domainAgeMonths: number | null | undefined): number {
  if (domainAgeMonths == null) return 1;
  // A brand-new store hasn't had time to find real sell-through yet.
  if (domainAgeMonths < 6) return 0.4;
  if (domainAgeMonths >= 24) return 1.2;
  return 1;
}

export function estimateMonthlyRevenue(
  avgPrice: number | null,
  catalogSize: number,
  context: RevenueContext = {}
): RevenueEstimate | null {
  if (avgPrice === null || catalogSize === 0) return null;

  const multiplier = popularityMultiplier(context.trancoRank) * maturityMultiplier(context.domainAgeMonths);
  const monthly = avgPrice * catalogSize * ASSUMED_UNITS_SOLD_PER_SKU_PER_MONTH * multiplier;

  return { monthly, source: 'heuristic' };
}
