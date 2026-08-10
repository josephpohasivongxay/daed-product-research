import { NextResponse } from 'next/server';
import { discoverCandidateDomains } from '@/lib/discovery';
import { fetchShopifyCatalog } from '@/lib/shopify';
import { SAMPLE_FALLBACK_DOMAINS } from '@/lib/sampleDomains';
import type { SearchResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get('niche')?.trim();

  if (!niche) {
    return NextResponse.json({ error: 'Niche keyword is required' }, { status: 400 });
  }

  try {
    let { domains, source } = await discoverCandidateDomains(niche, 12);

    if (domains.length === 0) {
      domains = SAMPLE_FALLBACK_DOMAINS;
      source = 'sample_fallback';
    }

    const catalogChecks = await Promise.allSettled(domains.map(fetchShopifyCatalog));

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
    };

    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch niche data' }, { status: 500 });
  }
}
