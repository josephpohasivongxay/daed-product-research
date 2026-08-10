import type { PriceStats, PricingGap } from './types';

/**
 * Clusters relevant-product prices into a low band and (if there's a real
 * gap) a premium band, surfacing whether a higher price tier looks
 * underserved. This is the one opportunity signal from the spec that's
 * genuinely data-driven with free public data — positioning/branding/UX
 * gaps would need either an LLM read of each store or manual review, so
 * aren't attempted here.
 */
export function computePricingGap(relevantAvgPrices: number[]): PricingGap | null {
  if (relevantAvgPrices.length < 3) return null;

  const sorted = [...relevantAvgPrices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const lowBand = sorted.filter((p) => p <= median);
  const highBand = sorted.filter((p) => p > median * 1.5);

  const stats = (arr: number[]): PriceStats => ({
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  });

  const clusterLow = stats(lowBand.length ? lowBand : sorted);

  if (highBand.length === 0) {
    return {
      clusterLow,
      clusterHigh: null,
      note: `Most relevant stores cluster around $${clusterLow.min.toFixed(0)}–$${clusterLow.max.toFixed(0)} with little presence above that — a premium tier may be underserved, but this could also mean the market doesn't support higher prices.`,
    };
  }

  const clusterHigh = stats(highBand);
  return {
    clusterLow,
    clusterHigh,
    note: `Most stores cluster around $${clusterLow.min.toFixed(0)}–$${clusterLow.max.toFixed(0)}, with a smaller premium cluster around $${clusterHigh.min.toFixed(0)}–$${clusterHigh.max.toFixed(0)} — both bands appear to have active sellers.`,
  };
}
