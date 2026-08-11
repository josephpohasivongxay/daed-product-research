import { NextResponse } from 'next/server';
import { buildStoreResult } from '@/lib/buildStoreResult';
import { fetchMetaAds } from '@/lib/metaAds';
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
    const [{ store }, metaAds] = await Promise.all([buildStoreResult(domain, niche), fetchMetaAds(domain)]);

    if (!store) {
      return NextResponse.json({ error: `Could not verify ${domain} as a store` }, { status: 404 });
    }

    const body: StoreDetailResponse = { success: true, store, metaAds };
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: 'Failed to load store details' }, { status: 500 });
  }
}
