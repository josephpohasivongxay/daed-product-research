import { ExternalLink, Megaphone, Music2, Tag, Clock, TrendingUp, Package, Flame, CalendarClock, BarChart2 } from 'lucide-react';
import type { StoreResult } from '@/lib/types';
import { formatCurrency, formatPriceRange, formatPercent, formatShortDate, formatAge, formatRank } from '@/lib/format';

export default function StoreCard({ store }: { store: StoreResult }) {
  const catalogLabel = store.catalogSizeIsApproximate
    ? `${store.productsSample}+ products`
    : `${store.productsSample} product${store.productsSample === 1 ? '' : 's'}`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <a
            href={`https://${store.domain}`}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1.5 text-base sm:text-lg font-semibold text-brand-300 hover:text-brand-200 truncate"
          >
            <span className="truncate">{store.domain}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
          </a>
          <p className="mt-0.5 text-xs text-slate-500">Shopify · {catalogLabel} sampled</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-xs text-slate-400">
        {store.priceStats && (
          <span className="inline-flex items-center gap-1">
            <Tag className="h-3.5 w-3.5 text-slate-600" />
            {formatPriceRange(store.priceStats.min, store.priceStats.max)}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Package className="h-3.5 w-3.5 text-slate-600" />
          {catalogLabel}
        </span>
        {store.latestProductAt && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-600" />
            Latest drop {formatShortDate(store.latestProductAt)}
          </span>
        )}
        {store.revenue && (
          <span className="inline-flex items-center gap-1" title="Rough estimate, not real sales data">
            <TrendingUp className="h-3.5 w-3.5 text-slate-600" />
            ~{formatCurrency(store.revenue.monthly)}/mo est.*
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

      <div className="flex flex-wrap gap-2">
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
