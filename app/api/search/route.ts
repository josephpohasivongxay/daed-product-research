import { NextResponse } from 'next/server';
import { discoverCandidateDomains } from '@/lib/discovery';
import { fetchShopifyCatalog } from '@/lib/shopify';
import { fetchDomainAge } from '@/lib/domainAge';
import { fetchPopularity } from '@/lib/popularity';
import { fetchHomepageSignal } from '@/lib/platformDetect';
import { fetchBestAvailableReviews } from '@/lib/reviews';
import { estimateTrafficFromRank } from '@/lib/trafficEstimate';
import { estimateMonthlyRevenue } from '@/lib/revenue';
import { scoreHomepageRelevance, homepageRelevancePercent } from '@/lib/relevance';
import { buildAdLinks } from '@/lib/adLinks';
import { fetchTrendSignal } from '@/lib/trends';
import { ALL_COMMUNITY_SOURCES, fetchCommunityMentions } from '@/lib/community';
import { computeMarketScore, computeStoreScore } from '@/lib/marketScore';
import { buildMarketEvidence } from '@/lib/marketEvidence';
import { generateVerdict } from '@/lib/verdict';
import { computePricingGap } from '@/lib/opportunity';
import { SAMPLE_FALLBACK_DOMAINS } from '@/lib/sampleDomains';
import type { CommunitySource, DemandSignal, Platform, SearchResponse, StoreResult } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const CANDIDATE_LIMIT = 30;
const RELEVANCE_EVIDENCE_THRESHOLD = 30;

function parseCommunitySources(raw: string | null): CommunitySource[] {
  if (raw === null) return ALL_COMMUNITY_SOURCES;
  if (raw.trim() === '') return [];

  const requested = raw.split(',').map((s) => s.trim());
  return ALL_COMMUNITY_SOURCES.filter((source) => requested.includes(source));
}

type StoreCheckResult = { store: StoreResult | null; platform: Platform };

/**
 * Tries the Shopify products.json path first (real product/price/review
 * data). If that fails, the candidate isn't dropped outright — its
 * homepage is read once for a platform fingerprint and a much thinner
 * relevance signal (title + meta description), so stores on other
 * platforms still show up in the catalog instead of vanishing, just with
 * less data and a lower ceiling on their relevance score.
 */
async function buildStoreResult(domain: string, niche: string): Promise<StoreCheckResult> {
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get('niche')?.trim();
  const communitySources = parseCommunitySources(searchParams.get('community'));

  if (!niche) {
    return NextResponse.json({ error: 'Niche keyword is required' }, { status: 400 });
  }

  try {
    let { domains, source } = await discoverCandidateDomains(niche, CANDIDATE_LIMIT);

    if (domains.length === 0) {
      domains = SAMPLE_FALLBACK_DOMAINS;
      source = 'sample_fallback';
    }

    const [storeChecks, trend, community] = await Promise.all([
      Promise.allSettled(domains.map((d) => buildStoreResult(d, niche))),
      fetchTrendSignal(niche),
      fetchCommunityMentions(niche, communitySources),
    ]);

    const results: StoreResult[] = [];
    const platformBreakdown: Partial<Record<Platform, number>> = {};

    for (const check of storeChecks) {
      if (check.status !== 'fulfilled') continue;
      const { store, platform } = check.value;
      platformBreakdown[platform] = (platformBreakdown[platform] ?? 0) + 1;
      // Only keep stores with at least some detected textual association
      // with the niche — this is what "every store that has association
      // with the keyword" means in practice, as opposed to every domain a
      // search engine happened to surface.
      if (store && store.relevancePercent > 0) {
        results.push(store);
      }
    }

    const demand: DemandSignal = { trend, community };
    const marketScore = computeMarketScore(results, demand);
    const evidence = buildMarketEvidence(results, platformBreakdown);
    const verdict = generateVerdict(marketScore, evidence, niche);

    const relevantAvgPrices = results
      .filter((r) => r.relevancePercent >= RELEVANCE_EVIDENCE_THRESHOLD)
      .map((r) => r.priceStats?.avg)
      .filter((v): v is number => v !== undefined && v !== null);
    const pricingGap = computePricingGap(relevantAvgPrices);

    const body: SearchResponse = {
      success: true,
      niche,
      source,
      candidatesScanned: domains.length,
      results,
      demand,
      market: { score: marketScore, evidence, verdict, pricingGap },
    };

    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch niche data' }, { status: 500 });
  }
}
