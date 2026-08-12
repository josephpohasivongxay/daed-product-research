import type {
  CommercialProofDetail,
  DemandSignal,
  MarketScore,
  ScoreLabel,
  StoreResult,
  StoreScore,
} from './types';

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

function reviewTierCredit(reviewCount: number): number {
  if (reviewCount >= 500) return 12;
  if (reviewCount >= 50) return 9;
  if (reviewCount >= 10) return 6;
  if (reviewCount > 0) return 3;
  return 0;
}

/**
 * Commercial Proof (40 pts) — Review Evidence 20 + Inventory Depletion 10 +
 * Sales-Signal Proxies 10, EXCEPT when review data is a total miss (not
 * "0 reviews found," but "no review data at all" — common, since most
 * stores don't expose JSON-LD or a matched widget-embed pattern): its
 * 20-point share is redistributed proportionally into the other two
 * (10→20 each), so a store with genuinely no review-app data isn't
 * structurally capped below one that happens to have Judge.me installed —
 * it just has to prove itself through inventory/sales-proxy evidence
 * instead, AT FULL WEIGHT. Missing review data must never quietly touch
 * any other signal's weighting — only an explicit, found-but-zero review
 * count (a real negative signal) downweights inventory depletion below.
 */
function computeCommercialProof(store: Omit<StoreResult, 'score'>): {
  total: number;
  detail: CommercialProofDetail;
} {
  const reviewDataRedistributed = store.reviews === null;
  const inventoryCap = reviewDataRedistributed ? 20 : 10;
  const salesProxyCap = reviewDataRedistributed ? 20 : 10;

  let reviewEvidence = 0;
  if (!reviewDataRedistributed) {
    const count = store.reviews!.reviewCount ?? 0;
    const base = reviewTierCredit(count);
    let recency: number;
    if (store.reviews!.recentReviewCount !== null) {
      const recent = store.reviews!.recentReviewCount;
      recency = recent >= 10 ? 8 : recent >= 5 ? 6 : recent >= 1 ? 3 : 0;
    } else {
      // This store's review data doesn't expose individual dates — neutral
      // partial credit derived from the base tier, not a penalty for a gap
      // in what the source exposes.
      recency = Math.round(base * 0.4);
    }
    reviewEvidence = Math.min(20, base + recency);
  }

  // Sold-out rate alone is ambiguous (could be poor restocking, not
  // demand) — downweight it ONLY when review data was actually found and
  // it shows zero reviews, a real (if soft) negative signal. When review
  // data is simply unavailable (reviewDataRedistributed), there's nothing
  // to corroborate OR contradict, so inventory evidence counts at full
  // (doubled) weight instead of being silently halved on top of already
  // losing its review-evidence share — a store's data gap shouldn't
  // compound into a second penalty on a completely different signal.
  const reviewsKnownWeak = !reviewDataRedistributed && (store.reviews!.reviewCount ?? 0) === 0;
  let inventoryDepletion = 0;
  if (store.soldOutRatio !== null) {
    inventoryDepletion = store.soldOutRatio * inventoryCap;
    if (reviewsKnownWeak) inventoryDepletion *= 0.5;
    inventoryDepletion = Math.min(inventoryCap, inventoryDepletion);
  }

  let salesProxies = 0;
  const signals = store.salesSignals;
  if (signals) {
    if (signals.isBestsellerListed) salesProxies += salesProxyCap * 0.5;
    if (signals.hasSoldCountBadge) salesProxies += salesProxyCap * 0.3;
    if (signals.partialSelloutRatio !== null) salesProxies += signals.partialSelloutRatio * salesProxyCap * 0.2;
    salesProxies = Math.min(salesProxyCap, salesProxies);
  }

  const total = Math.round(Math.min(40, reviewEvidence + inventoryDepletion + salesProxies));

  return {
    total,
    detail: {
      reviewEvidence: Math.round(reviewEvidence),
      inventoryDepletion: Math.round(inventoryDepletion),
      salesProxies: Math.round(salesProxies),
      reviewDataRedistributed,
    },
  };
}

/**
 * Operational Health (15 pts) — domain age, but weighted toward recent
 * signal freshness so a coasting multi-year-old store doesn't automatically
 * outscore an actively thriving newer one: raw age caps at 7 of the 15,
 * with the rest earned by recent catalog activity and recent review flow.
 */
function computeOperationalHealth(store: Omit<StoreResult, 'score'>): number {
  let ageCredit = 0;
  if (store.domainAge) {
    ageCredit = Math.min(store.domainAge.months / 36, 1) * 7;
  }

  let catalogFreshness = 0;
  if (store.latestProductAt) {
    const days = (Date.now() - new Date(store.latestProductAt).getTime()) / (1000 * 60 * 60 * 24);
    catalogFreshness = days <= 30 ? 5 : days <= 90 ? 3 : days <= 180 ? 1 : 0;
  }

  let reviewFreshness = 0;
  const recent = store.reviews?.recentReviewCount;
  if (recent !== null && recent !== undefined) {
    reviewFreshness = recent >= 5 ? 3 : recent >= 1 ? 1.5 : 0;
  }

  return Math.round(Math.min(15, ageCredit + catalogFreshness + reviewFreshness));
}

/** Traffic & Authority (15 pts) — Tranco rank tier only. The paid-traffic indicator is a display flag (and a Replicability input), not scored here. */
function computeTrafficAuthority(store: Omit<StoreResult, 'score'>): number {
  if (!store.traffic) return 0;
  return Math.round((TRAFFIC_TIER_WEIGHT[store.traffic.tier] ?? 0) * 15);
}

/** Catalog Investment (15 pts) — SKU/collection depth. Deliberately NOT recency-gated: a lean, static, high-converting catalog is investment evidence, not neglect. */
function computeCatalogInvestment(store: Omit<StoreResult, 'score'>): number {
  if (store.catalogSizeIsApproximate) return 15; // hit the 250-product sample cap — a real, invested catalog
  const n = store.productsSample;
  if (n >= 100) return 13;
  if (n >= 50) return 10;
  if (n >= 20) return 7;
  if (n >= 5) return 4;
  if (n > 0) return 2;
  return 0;
}

/** How "big" this store currently looks — the stronger of its traffic or review-volume signal, used only to gauge growth rate below. */
function scaleProxy(store: Omit<StoreResult, 'score'>): number {
  const trafficWeight = store.traffic ? TRAFFIC_TIER_WEIGHT[store.traffic.tier] ?? 0 : 0;
  const count = store.reviews?.reviewCount ?? 0;
  const reviewWeight = count >= 500 ? 1 : count >= 50 ? 0.6 : count >= 10 ? 0.3 : count > 0 ? 0.15 : 0;
  return Math.max(trafficWeight, reviewWeight);
}

/**
 * Replicability Flag (15 pts) — a composite estimate of "small operator
 * could realistically copy this," not "this store looks big or busy."
 * Three inputs, each pulling toward "bootstrapped and modelable" or away
 * toward "funded brand, not a realistic template":
 *
 * - Catalog size (5) — a lean catalog is easier to plan inventory/content
 *   around than a 250-SKU operation; smaller scores higher here (the
 *   inverse of Catalog Investment above, intentionally — the same fact
 *   means different things for "how proven" vs. "how copyable").
 * - Paid-traffic indicator (5) — no detected active ad spend reads as
 *   organic/bootstrap-built; detected ad spend reads as funded growth.
 *   Unknown (no META_ACCESS_TOKEN configured) gets neutral partial credit,
 *   never a penalty for missing data.
 * - Domain-age-to-scale ratio (5) — reaching real scale (traffic/reviews)
 *   FAST on a young domain usually means capital-backed paid growth, not a
 *   playbook a bootstrapper can copy; scale reached gradually over more
 *   time reads as organic and more realistically modelable.
 */
function computeReplicability(store: Omit<StoreResult, 'score'>): number {
  let points = 0;

  const n = store.productsSample;
  if (n === 0) points += 2.5; // no catalog data (non-Shopify) — can't assess, stay neutral
  else if (n <= 20) points += 5;
  else if (n <= 50) points += 4;
  else if (n <= 100) points += 2.5;
  else points += 1;

  if (store.paidTrafficIndicator === false) points += 5;
  else if (store.paidTrafficIndicator === null) points += 2.5;
  // paidTrafficIndicator === true adds 0 — active ad spend is a funded-brand signal.

  if (store.domainAge) {
    const growthRate = scaleProxy(store) / Math.max(store.domainAge.months, 1);
    if (growthRate <= 0.01) points += 5;
    else if (growthRate <= 0.03) points += 3;
    else if (growthRate <= 0.06) points += 1;
    // else 0 — scaled up fast, likely capital-backed rather than a bootstrapped climb
  } else {
    points += 2.5;
  }

  return Math.round(Math.min(15, points));
}

/**
 * Per-store score (0-100), v4: answers one question only — does this store
 * prove real, REPLICABLE sales, something a small operator can actually
 * model and enter against (not just "does this store look big or busy")?
 *
 * Relevance is NOT a category here — it's a pass/fail gate applied before a
 * store is ranked at all (lib/relevance.ts, RELEVANCE_GATE_*). Every store
 * reaching this function has already cleared that bar, so relevance has no
 * further effect on the score.
 *
 * Price/monetization tier is also explicitly out of scoring — a $15 item
 * and a $150 item are equally valid proof a niche sells. It's stored as
 * metadata (priceStats) and surfaced in angle-finding output instead.
 */
export function computeStoreScore(store: Omit<StoreResult, 'score'>): StoreScore {
  const { total: commercialProof, detail: commercialProofDetail } = computeCommercialProof(store);
  const operationalHealth = computeOperationalHealth(store);
  const trafficAuthority = computeTrafficAuthority(store);
  const catalogInvestment = computeCatalogInvestment(store);
  const replicability = computeReplicability(store);

  const total = Math.min(100, commercialProof + operationalHealth + trafficAuthority + catalogInvestment + replicability);

  return {
    total,
    breakdown: { commercialProof, operationalHealth, trafficAuthority, catalogInvestment, replicability },
    commercialProofDetail,
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
  // `results` is already gated to relevant stores upstream (lib/relevance.ts
  // RELEVANCE_GATE_*, applied in app/api/search/route.ts) — no need to
  // re-filter here.
  const relevantStores = results;
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
