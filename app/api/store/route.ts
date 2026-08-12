import { NextResponse } from 'next/server';
import { buildStoreResult } from '@/lib/buildStoreResult';
import { fetchMetaAds } from '@/lib/metaAds';
import { computeStoreScore } from '@/lib/marketScore';
import { computeAngleFindings } from '@/lib/angleFindings';
import type { StoreDetailResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain')?.trim();
  const niche = searchParams.get('niche')?.trim();

  if (!domain || !niche) {
    return NextResponse.json({ error: 'Both domain and niche are required' }, { status: 400 });
  }

  try {
    const [{ store: builtStore }, metaAds] = await Promise.all([buildStoreResult(domain, niche), fetchMetaAds(domain)]);

    if (!builtStore) {
      return NextResponse.json({ error: `Could not verify ${domain} as a store` }, { status: 404 });
    }

    const paidTrafficIndicator = metaAds ? metaAds.activeCount > 0 : null;
    const { score: _oldScore, ...rest } = { ...builtStore, paidTrafficIndicator };
    const rescored = { ...rest, score: computeStoreScore(rest) };
    const store = {
      ...rescored,
      angleFindings: computeAngleFindings(rescored, rescored.priceStats ? [rescored.priceStats.avg] : []),
    };

    const body: StoreDetailResponse = { success: true, store, metaAds };
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: 'Failed to load store details' }, { status: 500 });
  }
}
