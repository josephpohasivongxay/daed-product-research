import { fetchShopifyCatalog } from './shopify';
import { fetchDomainAge } from './domainAge';
import { fetchPopularity } from './popularity';
import { fetchHomepageSignal } from './platformDetect';
import { fetchBestAvailableReviews } from './reviews';
import { estimateTrafficFromRank } from './trafficEstimate';
import { estimateMonthlyRevenue } from './revenue';
import { scoreHomepageRelevance, homepageRelevancePercent } from './relevance';
import { buildAdLinks } from './adLinks';
import { computeStoreScore } from './marketScore';
import type { Platform, StoreResult } from './types';

export type StoreCheckResult = { store: StoreResult | null; platform: Platform };

/**
 * Tries the Shopify products.json path first (real product/price/review
 * data). If that fails, the candidate isn't dropped outright — its
 * homepage is read once for a platform fingerprint and a much thinner
 * relevance signal (title + meta description), so stores on other
 * platforms still show up in the catalog instead of vanishing, just with
 * less data and a lower ceiling on their relevance score.
 *
 * Shared by the bulk niche search route and the single-store detail route
 * so a store's numbers can never drift between the catalog card and its
 * detail page — same function, same inputs, same output.
 */
export async function buildStoreResult(domain: string, niche: string): Promise<StoreCheckResult> {
  const [catalog, domainAge, popularity] = await Promise.all([
    fetchShopifyCatalog(domain, niche),
    fetchDomainAge(domain),
    fetchPopularity(domain),
  ]);

  if (catalog) {
    const reviews = await fetchBestAvailableReviews(catalog.topProductUrls);
    const traffic = estimateTrafficFromRank(popularity?.trancoRank ?? null);
    const revenue = estimateMonthlyRevenue({
      traffic,
      avgPrice: catalog.priceStats?.avg ?? null,
      catalogSize: catalog.productsSample,
    });

    const partial: Omit<StoreResult, 'score'> = {
      domain: catalog.domain,
      platform: 'shopify',
      productsSample: catalog.productsSample,
      catalogSizeIsApproximate: catalog.catalogSizeIsApproximate,
      sampleProducts: catalog.sampleProducts,
      topProductUrl: catalog.topProductUrls[0] ?? null,
      relevancePercent: catalog.relevancePercent,
      relevantProductCount: catalog.relevantProductCount,
      priceStats: catalog.priceStats,
      latestProductAt: catalog.latestProductAt,
      revenue,
      traffic,
      reviews,
      soldOutRatio: catalog.soldOutRatio,
      soldOutVariants: catalog.soldOutVariants,
      totalVariants: catalog.totalVariants,
      domainAge,
      popularity,
      metaAdLink: catalog.metaAdLink,
      tiktokAdLink: catalog.tiktokAdLink,
    };

    const score = computeStoreScore(partial);
    return { store: { ...partial, score }, platform: 'shopify' };
  }

  const homepage = await fetchHomepageSignal(domain);
  if (!homepage.title && !homepage.description) {
    return { store: null, platform: homepage.platform };
  }

  const relevancePercent = homepageRelevancePercent(
    scoreHomepageRelevance(homepage.title, homepage.description, niche)
  );
  if (relevancePercent === 0) {
    return { store: null, platform: homepage.platform };
  }

  const partial: Omit<StoreResult, 'score'> = {
    domain,
    platform: homepage.platform,
    productsSample: 0,
    catalogSizeIsApproximate: false,
    sampleProducts: [],
    topProductUrl: null,
    relevancePercent,
    relevantProductCount: 0,
    priceStats: null,
    latestProductAt: null,
    revenue: null,
    traffic: estimateTrafficFromRank(popularity?.trancoRank ?? null),
    reviews: null,
    soldOutRatio: null,
    soldOutVariants: 0,
    totalVariants: 0,
    domainAge,
    popularity,
    ...buildAdLinks(domain),
  };

  const score = computeStoreScore(partial);
  return { store: { ...partial, score }, platform: homepage.platform };
}
