import { NextResponse } from 'next/server';
import { discoverCandidateDomains } from '@/lib/discovery';
import { fetchShopifyCatalog } from '@/lib/shopify';
import { fetchTrendSignal } from '@/lib/trends';
import { ALL_COMMUNITY_SOURCES, fetchCommunityMentions } from '@/lib/community';
import { SAMPLE_FALLBACK_DOMAINS } from '@/lib/sampleDomains';
import type { CommunitySource, SearchResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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
    let { domains, source } = await discoverCandidateDomains(niche, 12);

    if (domains.length === 0) {
      domains = SAMPLE_FALLBACK_DOMAINS;
      source = 'sample_fallback';
    }

    const [catalogChecks, trend, community] = await Promise.all([
      Promise.allSettled(domains.map(fetchShopifyCatalog)),
      fetchTrendSignal(niche),
      fetchCommunityMentions(niche, communitySources),
    ]);

    const results = catalogChecks
      .filter(
        (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fetchShopifyCatalog>>>> =>
          r.status === 'fulfilled' && r.value !== null
      )
      .map((r) => r.value);

    const body: SearchResponse = {
      success: true,
      niche,
      source,
      candidatesScanned: domains.length,
      results,
      demand: { trend, community },
    };

    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch niche data' }, { status: 500 });
  }
}
