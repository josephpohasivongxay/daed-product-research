import type { TrafficEstimate, TrafficTier } from './types';

/**
 * There's no free, real traffic API (SimilarWeb etc. are paid) — this
 * derives a coarse traffic *tier* from Tranco's popularity rank instead of
 * a fabricated precise number. A rank-to-visits formula that looks
 * authoritative but isn't calibrated would be worse than an honest range,
 * so this intentionally stays bucketed rather than pretending precision.
 */
const TIERS: { maxRank: number; low: number; high: number | null; tier: TrafficTier }[] = [
  { maxRank: 10_000, low: 1_000_000, high: null, tier: 'very high' },
  { maxRank: 100_000, low: 100_000, high: 1_000_000, tier: 'high' },
  { maxRank: 500_000, low: 10_000, high: 100_000, tier: 'moderate' },
  { maxRank: 1_000_000, low: 1_000, high: 10_000, tier: 'low' },
];

export function estimateTrafficFromRank(trancoRank: number | null): TrafficEstimate | null {
  if (trancoRank === null) return null;

  const bucket = TIERS.find((t) => trancoRank <= t.maxRank);
  if (!bucket) {
    return { monthlyVisitsLow: 0, monthlyVisitsHigh: 1_000, tier: 'minimal', method: 'tranco-rank-tier' };
  }

  return { monthlyVisitsLow: bucket.low, monthlyVisitsHigh: bucket.high, tier: bucket.tier, method: 'tranco-rank-tier' };
}
