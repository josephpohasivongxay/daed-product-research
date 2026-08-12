import { NextResponse } from 'next/server';
import { discoverCandidateDomains, DiscoveryUnavailableError } from '@/lib/discovery';
import { buildStoreResult } from '@/lib/buildStoreResult';
import { fetchTrendSignal } from '@/lib/trends';
import { ALL_COMMUNITY_SOURCES, fetchCommunityMentions } from '@/lib/community';
import { computeMarketScore, computeStoreScore } from '@/lib/marketScore';
import { buildMarketEvidence } from '@/lib/marketEvidence';
import { generateVerdict } from '@/lib/verdict';
import { computePricingGap } from '@/lib/opportunity';
import { computeMarketFit } from '@/lib/marketFit';
import { computeCommonAngles } from '@/lib/angles';
import { computeAngleFindings } from '@/lib/angleFindings';
import { fetchMetaAds } from '@/lib/metaAds';
import { mapWithConcurrency } from '@/lib/concurrency';
import { passesRelevanceGate } from '@/lib/relevance';
import type { CommunitySource, DemandSignal, Platform, SearchResponse, StoreResult } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

// Discovery runs 5 query variants through Tavily (~20 results each) and
// merges/dedupes the domains into one pool, capped here. This used to be
// capped at 30, which meant a niche with many more genuine stores than
// that still only ever got 30 candidates considered *before* the
// relevance gate even ran — raised to actually reflect what Tavily found
// instead of truncating it early.
const CANDIDATE_LIMIT = 60;
// Each candidate does several direct fetches (catalog, review pages,
// bestseller collection, domain age, popularity) — bounding how many run
// at once keeps a 60-candidate search from firing hundreds of requests
// together. The per-store fetches this bounds are now internally
// concurrent too (see lib/reviews.ts, lib/shopify.ts), so raising the
// candidate pool doesn't multiply worst-case per-store latency the way it
// would have before.
const CANDIDATE_CONCURRENCY = 10;
const ANGLE_FINDINGS_COUNT = 10;
const PAID_TRAFFIC_CONCURRENCY = 4;

function parseCommunitySources(raw: string | null): CommunitySource[] {
  if (raw === null) return ALL_COMMUNITY_SOURCES;
  if (raw.trim() === '') return [];

  const requested = raw.split(',').map((s) => s.trim());
  return ALL_COMMUNITY_SOURCES.filter((source) => requested.includes(source));
}

const GATE_OFF_VALUES = new Set(['off', '0', 'false']);

/** Defaults on — only an explicit ?gate=off (or 0/false) disables the relevance gate. */
function parseGateEnabled(raw: string | null): boolean {
  if (raw === null) return true;
  return !GATE_OFF_VALUES.has(raw.trim().toLowerCase());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get('niche')?.trim();
  const communitySources = parseCommunitySources(searchParams.get('community'));
  const gateEnabled = parseGateEnabled(searchParams.get('gate'));

  if (!niche) {
    return NextResponse.json({ error: 'Niche keyword is required' }, { status: 400 });
  }

  try {
    const { domains, source } = await discoverCandidateDomains(niche, CANDIDATE_LIMIT);

    const [storeChecks, trend, community] = await Promise.all([
      mapWithConcurrency(domains, CANDIDATE_CONCURRENCY, (d) => buildStoreResult(d, niche)),
      fetchTrendSignal(niche),
      fetchCommunityMentions(niche, communitySources),
    ]);

    let results: StoreResult[] = [];
    const platformBreakdown: Partial<Record<Platform, number>> = {};

    for (const check of storeChecks) {
      if (check.status !== 'fulfilled') continue;
      const { store, platform } = check.value;
      platformBreakdown[platform] = (platformBreakdown[platform] ?? 0) + 1;
      // Relevance is a pass/fail gate (lib/relevance.ts) by default — a
      // store has to clear it to be ranked at all, but clearing it by a
      // little vs. a lot makes no further difference. ?gate=off drops the
      // 60%/25% threshold but still requires SOME detected association
      // (relevancePercent > 0) — "show everything," not "show noise."
      if (!store || store.relevancePercent <= 0) continue;
      const passes = gateEnabled ? passesRelevanceGate(store.platform === 'shopify', store.relevancePercent) : true;
      if (passes) {
        results.push(store);
      }
    }

    // Paid-traffic indicator (Meta Ad Library presence) is only checked for
    // stores that already cleared the relevance gate — no point spending
    // API calls (and, when META_ACCESS_TOKEN is unset, this is a free
    // no-op per store) on candidates that won't be shown. It feeds the
    // Replicability Flag, so scores are recomputed after it's known.
    const withPaidTraffic = await mapWithConcurrency(results, PAID_TRAFFIC_CONCURRENCY, async (store) => {
      const metaAds = await fetchMetaAds(store.domain);
      const paidTrafficIndicator = metaAds ? metaAds.activeCount > 0 : null;
      const updated = { ...store, paidTrafficIndicator };
      const { score: _oldScore, ...rest } = updated;
      return { ...rest, score: computeStoreScore(rest) };
    });
    results = withPaidTraffic.map((r, i) => (r.status === 'fulfilled' ? r.value : results[i]));

    const demand: DemandSignal = { trend, community };
    const marketScore = computeMarketScore(results, demand);
    const evidence = buildMarketEvidence(results, platformBreakdown);
    const verdict = generateVerdict(marketScore, evidence, niche);

    const relevantAvgPrices = results
      .map((r) => r.priceStats?.avg)
      .filter((v): v is number => v !== undefined && v !== null);
    const pricingGap = computePricingGap(relevantAvgPrices);
    const marketFit = computeMarketFit(evidence, demand, pricingGap, results);
    const commonAngles = computeCommonAngles(results, niche);

    // Step 3 of the scoring spec: angle-finding output is required for the
    // top 10 stores by score, not optional. Attach in place so the rest of
    // the result set is untouched.
    const topByScore = [...results].sort((a, b) => b.score.total - a.score.total).slice(0, ANGLE_FINDINGS_COUNT);
    const topDomains = new Set(topByScore.map((s) => s.domain));
    results = results.map((store) =>
      topDomains.has(store.domain) ? { ...store, angleFindings: computeAngleFindings(store, relevantAvgPrices) } : store
    );

    const body: SearchResponse = {
      success: true,
      niche,
      source,
      candidatesScanned: domains.length,
      relevanceGateApplied: gateEnabled,
      results,
      demand,
      market: { score: marketScore, evidence, verdict, pricingGap, commonAngles },
      marketFit,
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
