import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { buildStoreResult } from '@/lib/buildStoreResult';
import { fetchMetaAds } from '@/lib/metaAds';
import StoreDetailView from '@/components/StoreDetailView';

export const dynamic = 'force-dynamic';

function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition mb-4"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to search
    </Link>
  );
}

export default async function StoreDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ niche?: string }>;
}) {
  const { domain: rawDomain } = await params;
  const { niche } = await searchParams;
  const domain = decodeURIComponent(rawDomain);

  if (!niche) {
    return (
      <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
        <BackLink />
        <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
          <p className="text-sm text-slate-400 mb-1">This page needs a niche to score relevance against.</p>
          <p className="text-xs text-slate-600">Open a store from a search result instead of this URL directly.</p>
        </div>
      </main>
    );
  }

  const [{ store }, metaAds] = await Promise.all([buildStoreResult(domain, niche), fetchMetaAds(domain)]);

  if (!store) {
    return (
      <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
        <BackLink />
        <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
          <p className="text-sm text-slate-400 mb-1">Couldn&rsquo;t verify {domain} right now.</p>
          <p className="text-xs text-slate-600">It may be temporarily unreachable, or no longer a live store.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto pb-16">
      <BackLink />
      <StoreDetailView store={store} metaAds={metaAds} niche={niche} />
    </main>
  );
}
