import type {
  DemandSignal,
  MarketScore,
  ScoreLabel,
  StoreResult,
  StoreScore,
} from './types';

/** Only stores with at least some lexical match count as market "evidence" — a bare mention shouldn't inflate the score. */
const RELEVANCE_EVIDENCE_THRESHOLD = 30;

export function interpretScore(total: number): ScoreLabel {
  if (total >= 90) return 'Extremely Validated';
  if (total >= 75) return 'Highly Validated';
  if (total >= 60) return 'Validated';
  if (total >= 40) return 'Uncertain';
  return 'Weak';
}

/**
 * Per-store score (0-100). Mirrors the niche-level Market Validation Score's
 * intent but swaps "Competition" (a market-wide concept) for "Popularity" —
 * how this one store's domain age and Tranco rank compare.
 */
export function computeStoreScore(store: Omit<StoreResult, 'score'>): StoreScore {
  const demand = Math.round((store.relevancePercent / 100) * 25);

  let commercialProof = 0;
  const reviewCount = store.reviews?.reviewCount ?? null;
  if (reviewCount !== null) {
    if (reviewCount >= 1000) commercialProof += 15;
    else if (reviewCount >= 100) commercialProof += 10;
    else if (reviewCount >= 10) commercialProof += 5;
  }
  if (store.soldOutRatio !== null) commercialProof += store.soldOutRatio * 10;
  commercialProof = Math.round(Math.min(25, commercialProof));

  let popularity = 0;
  if (store.popularity?.trancoRank != null) {
    popularity += Math.max(0, 1 - store.popularity.trancoRank / 1_000_000) * 12;
  }
  if (store.domainAge) {
    popularity += Math.min(store.domainAge.months / 24, 1) * 8;
  }
  popularity = Math.round(Math.min(20, popularity));

  let momentum = 0;
  if (store.latestProductAt) {
    const daysSince = (Date.now() - new Date(store.latestProductAt).getTime()) / (1000 * 60 * 60 * 24);
    momentum = daysSince <= 60 ? 20 : daysSince <= 180 ? 10 : 0;
  }

  let monetization = 0;
  if (store.revenue) {
    if (store.revenue.base >= 50_000) monetization = 10;
    else if (store.revenue.base >= 10_000) monetization = 7;
    else if (store.revenue.base >= 1_000) monetization = 4;
    else monetization = 2;
  }

  const total = Math.min(100, demand + commercialProof + popularity + momentum + monetization);

  return {
    total,
    breakdown: { demand, commercialProof, popularity, momentum, monetization },
    label: interpretScore(total),
  };
}

/**
 * Niche-wide score (0-100) across every relevant store found, plus the
 * demand-signal panel (Trends/community). Competition here is treated per
 * the spec's own framing: more established competitors is evidence a
 * market exists, not a straightforward penalty — it only pulls back
 * slightly at the extreme end to reflect saturation risk.
 */
export function computeMarketScore(results: StoreResult[], demandSignal: DemandSignal): MarketScore {
  const relevantStores = results.filter((r) => r.relevancePercent >= RELEVANCE_EVIDENCE_THRESHOLD);
  const storeCount = relevantStores.length;

  // Demand
  const storeCountDemand = Math.min(1, storeCount / 15) * 10;
  const trendDemand = demandSignal.trend?.status === 'rising' ? 10 : demandSignal.trend?.status === 'steady' ? 5 : 0;
  const totalCommunityMentions = demandSignal.community.reduce((sum, m) => sum + m.count, 0);
  const communityDemand = Math.min(1, totalCommunityMentions / 30) * 5;
  const demand = Math.round(storeCountDemand + trendDemand + communityDemand);

  // Commercial Proof
  const highTrafficCount = relevantStores.filter(
    (r) => r.traffic?.tier === 'high' || r.traffic?.tier === 'very high'
  ).length;
  const trafficProof = Math.min(1, highTrafficCount / 5) * 10;
  const reviewedStores = relevantStores.filter((r) => (r.reviews?.reviewCount ?? 0) >= 100).length;
  const reviewProof = Math.min(1, reviewedStores / 5) * 10;
  const soldOutValues = relevantStores.map((r) => r.soldOutRatio).filter((v): v is number => v !== null);
  const avgSoldOut = soldOutValues.length ? soldOutValues.reduce((a, b) => a + b, 0) / soldOutValues.length : 0;
  const soldOutProof = avgSoldOut * 5;
  const commercialProof = Math.round(Math.min(25, trafficProof + reviewProof + soldOutProof));

  // Competition / Market Structure — additive, not punitive
  let competition: number;
  if (storeCount === 0) competition = 0;
  else if (storeCount <= 2) competition = 5;
  else if (storeCount <= 7) competition = 15;
  else if (storeCount <= 15) competition = 20;
  else competition = 18; // extreme saturation: still strong evidence, small pull-back

  // Momentum
  const recentActivityCount = relevantStores.filter((r) => {
    if (!r.latestProductAt) return false;
    const days = (Date.now() - new Date(r.latestProductAt).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 60;
  }).length;
  const activityMomentum = storeCount > 0 ? Math.min(1, recentActivityCount / storeCount) * 12 : 0;
  const trendMomentum = demandSignal.trend?.status === 'rising' ? 8 : demandSignal.trend?.status === 'steady' ? 4 : 0;
  const momentum = Math.round(activityMomentum + trendMomentum);

  // Monetization
  const prices = relevantStores.map((r) => r.priceStats?.avg).filter((v): v is number => v !== undefined && v !== null);
  const avgMarketPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  let monetization = 0;
  if (avgMarketPrice >= 50) monetization = 10;
  else if (avgMarketPrice >= 20) monetization = 7;
  else if (avgMarketPrice >= 10) monetization = 4;
  else if (avgMarketPrice > 0) monetization = 2;

  const total = Math.min(100, demand + commercialProof + competition + momentum + monetization);

  return {
    total,
    breakdown: { demand, commercialProof, competition, momentum, monetization },
    label: interpretScore(total),
  };
}
