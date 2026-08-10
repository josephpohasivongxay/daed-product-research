import { ExternalLink, Megaphone, Music2 } from 'lucide-react';
import type { StoreResult } from '@/lib/types';

export default function StoreCard({ store }: { store: StoreResult }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
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
          <p className="mt-0.5 text-xs text-slate-500">
            Shopify · {store.productsSample} product{store.productsSample === 1 ? '' : 's'} sampled
          </p>
        </div>
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
