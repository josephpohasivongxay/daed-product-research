import { NextResponse } from 'next/server';
import { discoverCandidateDomains, DiscoveryUnavailableError } from '@/lib/discovery';
import { buildStoreResult } from '@/lib/buildStoreResult';
import { fetchTrendSignal } from '@/lib/trends';
import { ALL_COMMUNITY_SOURCES, fetchCommunityMentions } from '@/lib/community';
import { computeMarketScore } from '@/lib/marketScore';
import { buildMarketEvidence } from '@/lib/marketEvidence';
import { generateVerdict } from '@/lib/verdict';
import { computePricingGap } from '@/lib/opportunity';
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get('niche')?.trim();
  const communitySources = parseCommunitySources(searchParams.get('community'));

  if (!niche) {
    return NextResponse.json({ error: 'Niche keyword is required' }, { status: 400 });
  }

  try {
    const { domains, source } = await discoverCandidateDomains(niche, CANDIDATE_LIMIT);

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
    if (error instanceof DiscoveryUnavailableError) {
      return NextResponse.json(
        {
          error:
            "Can't connect to Tavily search right now. Check that TAVILY_API_KEY is set (and valid) in your deployment's environment variables, then try again.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to fetch niche data' }, { status: 500 });
  }
}
