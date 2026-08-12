import { ExternalLink, Megaphone, Music2 } from 'lucide-react';
import type { MetaAdsSignal, StoreResult } from '@/lib/types';
import {
  formatPriceRange,
  formatPercent,
  formatShortDate,
  formatAge,
  formatRank,
  formatRevenueRange,
  formatTrafficRange,
  formatPlatformLabel,
  formatDuration,
} from '@/lib/format';

const SCORE_COLOR = (total: number) => {
  if (total >= 75) return 'text-emerald-400 border-emerald-900 bg-emerald-950/40';
  if (total >= 60) return 'text-brand-300 border-brand-900 bg-brand-950/40';
  if (total >= 40) return 'text-amber-400 border-amber-900 bg-amber-950/40';
  return 'text-slate-400 border-slate-800 bg-slate-900';
};

const CATEGORY_META: { key: keyof StoreResult['score']['breakdown']; label: string; max: number }[] = [
  { key: 'salesEvidence', label: 'Sales Evidence', max: 45 },
  { key: 'longevity', label: 'Longevity', max: 25 },
  { key: 'relevance', label: 'Relevance', max: 30 },
];

function StatBlock({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3" title={hint}>
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      <p className="text-sm text-slate-200 font-medium">{value}</p>
    </div>
  );
}

function MetaAdsSection({ metaAds, fallbackLink }: { metaAds: MetaAdsSignal | null; fallbackLink: string }) {
  if (!metaAds) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Facebook / Meta ads</p>
        <p className="text-sm text-slate-400 mb-3">
          Ad data isn&rsquo;t available — either <code className="text-slate-500">META_ACCESS_TOKEN</code>{' '}
          isn&rsquo;t configured, or Meta&rsquo;s API didn&rsquo;t return a match for this store&rsquo;s
          guessed brand name.
        </p>
        <a
          href={fallbackLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
        >
          <Megaphone className="h-3.5 w-3.5" />
          Check Meta Ad Library manually
        </a>
      </div>
    );
  }

  if (metaAds.activeCount === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Facebook / Meta ads</p>
        <p className="text-sm text-slate-400">
          No active ads found searching Meta&rsquo;s Ad Library for &ldquo;{metaAds.searchedAs}&rdquo;. That
          could mean they&rsquo;re not currently advertising on Meta, or their page name doesn&rsquo;t match
          this guess — worth a manual check via the link on the search results card.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Facebook / Meta ads</p>
      <div className="flex items-baseline gap-4 mb-4">
        <div>
          <span className="text-2xl font-bold text-emerald-400">{metaAds.activeCount}</span>
          <span className="text-xs text-slate-500 ml-1.5">active ad{metaAds.activeCount === 1 ? '' : 's'}</span>
        </div>
        {metaAds.longestRunningDays !== null && (
          <div>
            <span className="text-2xl font-bold text-brand-300">{formatDuration(metaAds.longestRunningDays)}</span>
            <span className="text-xs text-slate-500 ml-1.5">longest-running</span>
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-600 mb-3">
        An ad that&rsquo;s been running a while is a decent signal it&rsquo;s working — Meta doesn&rsquo;t
        expose spend/impressions for non-political ads, so duration is the strongest proxy available here.
      </p>
      <div className="grid gap-2">
        {metaAds.ads.map((ad) => (
          <div key={ad.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-xs text-slate-300 line-clamp-2 flex-1">{ad.creativeBody || 'No creative text captured'}</p>
              {ad.daysRunning !== null && (
                <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                  {formatDuration(ad.daysRunning)}
                </span>
              )}
            </div>
            {ad.snapshotUrl && (
              <a
                href={ad.snapshotUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-brand-400 hover:text-brand-300"
              >
                View ad ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StoreDetailView({
  store,
  metaAds,
  niche,
}: {
  store: StoreResult;
  metaAds: MetaAdsSignal | null;
  niche: string;
}) {
  const hasProductData = store.productsSample > 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-50 truncate">{store.domain}</h1>
          <p className="text-sm text-slate-500">
            {formatPlatformLabel(store.platform)} · {formatPercent(store.relevancePercent / 100)} match to
            &ldquo;{niche}&rdquo;
          </p>
        </div>
        <div className={`shrink-0 rounded-xl border px-3 py-2 text-center ${SCORE_COLOR(store.score.total)}`}>
          <div className="text-xl font-bold leading-none">{store.score.total}</div>
          <div className="text-[9px] uppercase tracking-wide opacity-80">/100</div>
        </div>
      </div>

      <a
        href={`https://${store.domain}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-brand-300 hover:text-brand-200 mb-6"
      >
        Visit site
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 mb-6">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5">Store Validation Score</p>
        <p className="text-[11px] text-slate-600 mb-3">
          Scored on proof of sales and staying power only. Price point is deliberately not scored
          here — see the price stat below for that, as brand-positioning context, not validation.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CATEGORY_META.map(({ key, label, max }) => {
            const value = store.score.breakdown[key];
            const pct = Math.round((value / max) * 100);
            return (
              <div key={key}>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>{label}</span>
                  <span>
                    {value}/{max}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {store.priceStats && (
          <StatBlock
            label="Relevant price range"
            value={formatPriceRange(store.priceStats.min, store.priceStats.max)}
          />
        )}
        <StatBlock
          label="Catalog size"
          value={hasProductData ? `${store.productsSample}${store.catalogSizeIsApproximate ? '+' : ''}` : 'No product data'}
        />
        {store.reviews && (store.reviews.reviewCount !== null || store.reviews.rating !== null) && (
          <StatBlock
            label="Reviews"
            value={`${store.reviews.reviewCount !== null ? store.reviews.reviewCount.toLocaleString() : '—'}${
              store.reviews.rating !== null ? ` · ${store.reviews.rating.toFixed(1)}★` : ''
            }`}
            hint="From this store's public product-page structured data"
          />
        )}
        {store.traffic && (
          <StatBlock
            label="Est. monthly traffic"
            value={formatTrafficRange(store.traffic.monthlyVisitsLow, store.traffic.monthlyVisitsHigh)}
            hint="Derived from Tranco rank, not measured traffic"
          />
        )}
        {store.latestProductAt && (
          <StatBlock label="Latest catalog activity" value={formatShortDate(store.latestProductAt)} />
        )}
        {store.revenue && (
          <StatBlock
            label={`Est. monthly revenue (${store.revenue.confidence} conf.)`}
            value={`${formatRevenueRange(store.revenue.low, store.revenue.high)}*`}
            hint={store.revenue.method}
          />
        )}
        {store.soldOutRatio !== null && (
          <StatBlock
            label="Sold out"
            value={formatPercent(store.soldOutRatio)}
            hint={`${store.soldOutVariants} of ${store.totalVariants} sampled variants unavailable`}
          />
        )}
        {store.domainAge && (
          <StatBlock
            label="Domain age"
            value={formatAge(store.domainAge.months)}
            hint={store.domainAge.source === 'rdap' ? 'Registration date' : 'First seen in Wayback Machine'}
          />
        )}
        {store.popularity?.trancoRank != null && (
          <StatBlock label="Popularity" value={formatRank(store.popularity.trancoRank)} hint="Tranco domain rank" />
        )}
      </div>

      {store.sampleProducts.length > 0 && (
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">Relevant products</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {store.sampleProducts.map((p, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-800 mb-2">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-600">
                      No image
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-200 truncate">{p.title}</p>
                <p className="text-xs text-slate-500">${p.price}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <MetaAdsSection metaAds={metaAds} fallbackLink={store.metaAdLink} />
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={store.metaAdLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
        >
          <Megaphone className="h-3.5 w-3.5" />
          Meta Ad Library
        </a>
        <a
          href={store.tiktokAdLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
        >
          <Music2 className="h-3.5 w-3.5" />
          TikTok Creative Center
        </a>
      </div>

      <p className="text-[11px] text-slate-600 mt-6">
        * Est. revenue and traffic are rough estimates derived from public signals — not real sales or
        analytics data.
      </p>
    </div>
  );
}
