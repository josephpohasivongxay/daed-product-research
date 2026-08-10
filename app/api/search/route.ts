import { NextResponse } from 'next/server';
import { discoverCandidateDomains } from '@/lib/discovery';
import { fetchShopifyCatalog } from '@/lib/shopify';
import { fetchDomainAge } from '@/lib/domainAge';
import { fetchPopularity } from '@/lib/popularity';
import { detectPlatform } from '@/lib/platformDetect';
import { fetchBestAvailableReviews } from '@/lib/reviews';
import { estimateTrafficFromRank } from '@/lib/trafficEstimate';
import { estimateMonthlyRevenue } from '@/lib/revenue';
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

const RELEVANCE_EVIDENCE_THRESHOLD = 30;

function parseCommunitySources(raw: string | null): CommunitySource[] {
  if (raw === null) return ALL_COMMUNITY_SOURCES;
  if (raw.trim() === '') return [];

  const requested = raw.split(',').map((s) => s.trim());
  return ALL_COMMUNITY_SOURCES.filter((source) => requested.includes(source));
}

type StoreCheckResult = { store: StoreResult | null; platform: Platform | null };

async function buildStoreResult(domain: string, niche: string): Promise<StoreCheckResult> {
  const [catalog, domainAge, popularity] = await Promise.all([
    fetchShopifyCatalog(domain, niche),
    fetchDomainAge(domain),
    fetchPopularity(domain),
  ]);

  if (!catalog) {
    const detection = await detectPlatform(domain);
    return { store: null, platform: detection.platform };
  }

  const reviews = await fetchBestAvailableReviews(catalog.topProductUrls);
  const traffic = estimateTrafficFromRank(popularity?.trancoRank ?? null);
  const revenue = estimateMonthlyRevenue({
    traffic,
    avgPrice: catalog.priceStats?.avg ?? null,
    catalogSize: catalog.productsSample,
  });

  const partial: Omit<StoreResult, 'score'> = {
    domain: catalog.domain,
    platform: catalog.platform,
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get('niche')?.trim();
  const communitySources = parseCommunitySources(searchParams.get('community'));

  if (!niche) {
    return NextResponse.json({ error: 'Niche keyword is required' }, { status: 400 });
  }

  try {
    let { domains, source } = await discoverCandidateDomains(niche, 20);

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
      if (store) {
        results.push(store);
      } else if (platform) {
        platformBreakdown[platform] = (platformBreakdown[platform] ?? 0) + 1;
      }
    }
    if (results.length > 0) {
      platformBreakdown.shopify = results.length;
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
