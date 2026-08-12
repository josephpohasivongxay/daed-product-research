import Link from 'next/link';
import {
  ExternalLink,
  Megaphone,
  Music2,
  Tag,
  Clock,
  TrendingUp,
  Package,
  Flame,
  CalendarClock,
  BarChart2,
  Star,
  Target,
  Users,
  Info,
  ChevronRight,
} from 'lucide-react';
import type { StoreResult } from '@/lib/types';
import {
  formatPriceRange,
  formatPercent,
  formatShortDate,
  formatAge,
  formatRank,
  formatRevenueRange,
  formatTrafficRange,
  formatPlatformLabel,
} from '@/lib/format';

const SCORE_COLOR = (total: number) => {
  if (total >= 75) return 'text-emerald-400 border-emerald-900 bg-emerald-950/40';
  if (total >= 60) return 'text-brand-300 border-brand-900 bg-brand-950/40';
  if (total >= 40) return 'text-amber-400 border-amber-900 bg-amber-950/40';
  return 'text-slate-400 border-slate-800 bg-slate-900';
};

export default function StoreCard({ store, niche }: { store: StoreResult; niche: string }) {
  const hasProductData = store.productsSample > 0;
  const catalogLabel = hasProductData
    ? store.catalogSizeIsApproximate
      ? `${store.productsSample}+ products`
      : `${store.productsSample} product${store.productsSample === 1 ? '' : 's'}`
    : 'Limited data';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <Link
            href={`/store/${encodeURIComponent(store.domain)}?niche=${encodeURIComponent(niche)}`}
            className="group inline-flex items-center gap-1 text-base sm:text-lg font-semibold text-brand-300 hover:text-brand-200 truncate"
          >
            <span className="truncate">{store.domain}</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatPlatformLabel(store.platform)} · {catalogLabel} ·{' '}
            {formatPercent(store.relevancePercent / 100)} match to search
          </p>
        </div>
        <div
          className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-center ${SCORE_COLOR(store.score.total)}`}
          title="Store Validation Score — sales evidence (reviews, sold-out rate, traffic) + longevity (domain age, recent activity) + relevance to your search. Price point is shown separately, not scored."
        >
          <div className="text-base font-bold leading-none">{store.score.total}</div>
          <div className="text-[9px] uppercase tracking-wide opacity-80">/100</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-xs text-slate-400">
        {store.priceStats && (
          <span className="inline-flex items-center gap-1">
            <Tag className="h-3.5 w-3.5 text-slate-600" />
            {formatPriceRange(store.priceStats.min, store.priceStats.max)}
          </span>
        )}
        {hasProductData ? (
          <span className="inline-flex items-center gap-1">
            <Package className="h-3.5 w-3.5 text-slate-600" />
            {catalogLabel}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1"
            title="Not a Shopify store, so product/price/review data isn't available — relevance is based on the homepage only"
          >
            <Info className="h-3.5 w-3.5 text-slate-600" />
            No product data (non-Shopify)
          </span>
        )}
        {store.reviews && (store.reviews.reviewCount !== null || store.reviews.rating !== null) && (
          <span className="inline-flex items-center gap-1" title="From this store's public product-page structured data">
            <Star className="h-3.5 w-3.5 text-slate-600" />
            {store.reviews.reviewCount !== null ? `${store.reviews.reviewCount.toLocaleString()} reviews` : ''}
            {store.reviews.rating !== null ? ` · ${store.reviews.rating.toFixed(1)}★` : ''}
          </span>
        )}
        {store.traffic && (
          <span className="inline-flex items-center gap-1" title="Estimated tier derived from Tranco rank, not measured traffic">
            <Users className="h-3.5 w-3.5 text-slate-600" />
            {formatTrafficRange(store.traffic.monthlyVisitsLow, store.traffic.monthlyVisitsHigh)} visits/mo est.
          </span>
        )}
        {store.latestProductAt && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-600" />
            Latest drop {formatShortDate(store.latestProductAt)}
          </span>
        )}
        {store.revenue && (
          <span
            className="inline-flex items-center gap-1"
            title={`${store.revenue.method} — ${store.revenue.confidence} confidence, not real sales data`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-slate-600" />
            {formatRevenueRange(store.revenue.low, store.revenue.high)}/mo est.*
          </span>
        )}
        {store.soldOutRatio !== null && (
          <span
            className="inline-flex items-center gap-1"
            title={`${store.soldOutVariants} of ${store.totalVariants} sampled variants unavailable — may signal strong sell-through or slow restocking`}
          >
            <Flame className="h-3.5 w-3.5 text-slate-600" />
            {formatPercent(store.soldOutRatio)} sold out
          </span>
        )}
        {store.domainAge && (
          <span
            className="inline-flex items-center gap-1"
            title={store.domainAge.source === 'rdap' ? 'Domain registration age' : 'First seen in the Wayback Machine (lower bound)'}
          >
            <CalendarClock className="h-3.5 w-3.5 text-slate-600" />
            {formatAge(store.domainAge.months)}
          </span>
        )}
        {store.popularity?.trancoRank != null && (
          <span className="inline-flex items-center gap-1" title="Tranco domain popularity rank">
            <BarChart2 className="h-3.5 w-3.5 text-slate-600" />
            {formatRank(store.popularity.trancoRank)}
          </span>
        )}
      </div>

      {store.sampleProducts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {store.sampleProducts.map((p, idx) => (
            <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-800 mb-2">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt={p.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
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
      )}

      <div className="flex flex-wrap gap-2">
        <a
          href={`https://${store.domain}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Visit site
        </a>
        {store.topProductUrl && (
          <a
            href={store.topProductUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            <Target className="h-3.5 w-3.5" />
            Top match
          </a>
        )}
        <a
          href={store.metaAdLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
        >
          <Megaphone className="h-3.5 w-3.5" />
          Meta Ads
        </a>
        <a
          href={store.tiktokAdLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
        >
          <Music2 className="h-3.5 w-3.5" />
          TikTok Ads
        </a>
      </div>
    </div>
  );
}
