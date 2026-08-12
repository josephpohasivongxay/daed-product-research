import type { MarketEvidence, Platform, PriceStats, StoreResult } from './types';

export function buildMarketEvidence(
  results: StoreResult[],
  platformBreakdown: Partial<Record<Platform, number>>
): MarketEvidence {
  // `results` is already gated to relevant stores upstream (see
  // lib/relevance.ts RELEVANCE_GATE_*, applied in app/api/search/route.ts).
  const relevantStores = results;

  const highTrafficStoreCount = relevantStores.filter(
    (r) => r.traffic?.tier === 'high' || r.traffic?.tier === 'very high'
  ).length;
  const wellReviewedStoreCount = relevantStores.filter((r) => (r.reviews?.reviewCount ?? 0) >= 100).length;

  const prices = relevantStores.map((r) => r.priceStats).filter((p): p is PriceStats => p !== null);
  const typicalPriceRange: PriceStats | null = prices.length
    ? {
        min: Math.min(...prices.map((p) => p.min)),
        max: Math.max(...prices.map((p) => p.max)),
        avg: prices.reduce((sum, p) => sum + p.avg, 0) / prices.length,
      }
    : null;

  const trafficStores = relevantStores.filter((r) => r.traffic !== null);
  const estimatedCombinedTraffic = trafficStores.length
    ? {
        low: trafficStores.reduce((sum, r) => sum + (r.traffic?.monthlyVisitsLow ?? 0), 0),
        high: trafficStores.every((r) => r.traffic?.monthlyVisitsHigh !== null)
          ? trafficStores.reduce((sum, r) => sum + (r.traffic?.monthlyVisitsHigh ?? 0), 0)
          : null,
      }
    : null;

  const revenueStores = relevantStores.filter((r) => r.revenue !== null);
  const estimatedMarketRevenue = revenueStores.length
    ? {
        low: revenueStores.reduce((sum, r) => sum + (r.revenue?.low ?? 0), 0),
        high: revenueStores.reduce((sum, r) => sum + (r.revenue?.high ?? 0), 0),
        confidence: revenueStores.some((r) => r.revenue?.confidence === 'low')
          ? ('low' as const)
          : ('medium' as const),
      }
    : null;

  return {
    relevantStoreCount: relevantStores.length,
    highTrafficStoreCount,
    wellReviewedStoreCount,
    typicalPriceRange,
    estimatedCombinedTraffic,
    estimatedMarketRevenue,
    platformBreakdown,
  };
}
