import type {
  DemandSignal,
  MarketScore,
  ScoreLabel,
  StoreResult,
  StoreScore,
} from './types';

/** Only stores with at least some lexical match count as market "evidence" — a bare mention shouldn't inflate the score. */
const RELEVANCE_EVIDENCE_THRESHOLD = 30;

const TRAFFIC_TIER_WEIGHT: Record<string, number> = {
  'very high': 1,
  high: 0.8,
  moderate: 0.5,
  low: 0.25,
  minimal: 0.1,
};

export function interpretScore(total: number): ScoreLabel {
  if (total >= 90) return 'Extremely Validated';
  if (total >= 75) return 'Highly Validated';
  if (total >= 60) return 'Validated';
  if (total >= 40) return 'Uncertain';
  return 'Weak';
}

/**
 * Per-store score (0-100), redesigned around one question: does this store
 * actually prove people buy in this niche? Three categories, each earning
 * its place:
 *
 * - Sales Evidence (45) — reviews, sold-out rate, traffic. The only direct
 *   purchase evidence this tool has access to; weighted highest because
 *   it's the closest thing to "proof," not just correlation.
 * - Longevity (25) — domain age + recent catalog activity. Not proof of
 *   sales by itself, but a filter against dead/abandoned/test stores —
 *   necessary context, not a validation signal on its own.
 * - Relevance (30) — how well this store's catalog matches the searched
 *   niche. A gate ("is this even on-topic"), not evidence of demand —
 *   an earlier version of this score called this "Demand," which was
 *   wrong: it's lexical match strength, not market demand.
 *
 * Deliberately dropped as scored categories: raw traffic-rank "Popularity"
 * (its useful half, domain age, moved into Longevity; its traffic half
 * moved into Sales Evidence, so it's no longer double-counted across two
 * categories) and "Monetization" (price tier). Price point isn't evidence
 * a niche is validated — a $15 store and a $150 store can be equally
 * proven — it's brand-positioning information, so it stays visible on
 * every store card and detail page without being folded into the score.
 */
export function computeStoreScore(store: Omit<StoreResult, 'score'>): StoreScore {
  let salesEvidence = 0;
  const reviewCount = store.reviews?.reviewCount ?? null;
  if (reviewCount !== null) {
    // A real niche DTC store with any visible reviews at all is already
    // meaningful evidence — 500+ reviews is a strong bar for most stores
    // this tool finds, not a bar reserved for major-brand storefronts.
    if (reviewCount >= 500) salesEvidence += 22;
    else if (reviewCount >= 50) salesEvidence += 16;
    else if (reviewCount >= 10) salesEvidence += 10;
    else if (reviewCount > 0) salesEvidence += 5;
  }
  if (store.soldOutRatio !== null) salesEvidence += store.soldOutRatio * 13;
  if (store.traffic) {
    salesEvidence += (TRAFFIC_TIER_WEIGHT[store.traffic.tier] ?? 0) * 10;
  }
  salesEvidence = Math.round(Math.min(45, salesEvidence));

  let longevity = 0;
  if (store.domainAge) {
    longevity += Math.min(store.domainAge.months / 24, 1) * 15;
  }
  if (store.latestProductAt) {
    const daysSince = (Date.now() - new Date(store.latestProductAt).getTime()) / (1000 * 60 * 60 * 24);
    longevity += daysSince <= 60 ? 10 : daysSince <= 180 ? 5 : 0;
  }
  longevity = Math.round(Math.min(25, longevity));

  const relevance = Math.round((store.relevancePercent / 100) * 30);

  const total = Math.min(100, salesEvidence + longevity + relevance);

  return {
    total,
    breakdown: { salesEvidence, longevity, relevance },
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

  // Commercial Proof — proportional to how many relevant stores were
  // actually found, not a fixed "5 stores needed" bar. A real niche search
  // often surfaces well under 5 relevant stores total, and Tranco's
  // "high"/"very high" tiers (top 100K/10K globally) are a bar almost no
  // niche DTC store clears even when it's genuinely doing well.
  const storesWithTraffic = relevantStores.filter((r) => r.traffic !== null);
  const trafficProof = storesWithTraffic.length
    ? (storesWithTraffic.reduce((sum, r) => sum + (TRAFFIC_TIER_WEIGHT[r.traffic!.tier] ?? 0), 0) /
        storesWithTraffic.length) *
      8
    : 0;

  const storesWithAnyReviews = relevantStores.filter((r) => (r.reviews?.reviewCount ?? 0) > 0);
  const storesWithStrongReviews = relevantStores.filter((r) => (r.reviews?.reviewCount ?? 0) >= 50);
  const reviewProof =
    storeCount > 0
      ? Math.min(1, storesWithAnyReviews.length / storeCount) * 7 +
        Math.min(1, storesWithStrongReviews.length / storeCount) * 5
      : 0;

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
