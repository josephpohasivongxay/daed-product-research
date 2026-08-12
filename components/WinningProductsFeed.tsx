import Link from 'next/link';
import { ExternalLink, Flame, Megaphone, Star } from 'lucide-react';
import type { WinningProduct } from '@/lib/types';
import { AD_MOMENTUM_BADGE_STYLE } from '@/lib/adMomentum';
import { formatPercent } from '@/lib/format';

function ProductCard({ product, niche }: { product: WinningProduct; niche: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <a
        href={product.url ?? `https://${product.storeDomain}`}
        target="_blank"
        rel="noreferrer"
        className="block aspect-square w-full overflow-hidden bg-slate-800"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
      </a>
      <div className="p-3">
        <p className="text-sm font-medium text-slate-200 line-clamp-2 mb-1">{product.title}</p>
        <p className="text-sm text-brand-300 font-semibold mb-2">${product.price}</p>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {product.isBestseller && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-800 bg-amber-950/50 px-2 py-0.5 text-[10px] text-amber-300">
              <Star className="h-3 w-3" />
              Bestseller
            </span>
          )}
          {product.soldOutRatio !== null && product.soldOutRatio > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300"
              title="Share of this product's sampled variants marked unavailable"
            >
              <Flame className="h-3 w-3" />
              {formatPercent(product.soldOutRatio)} sold out
            </span>
          )}
          {product.adMomentum && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${AD_MOMENTUM_BADGE_STYLE[product.adMomentum]}`}
              title="Derived from this store's active Meta/Facebook ads — not scored, a display signal only"
            >
              <Megaphone className="h-3 w-3" />
              {product.adMomentum}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/store/${encodeURIComponent(product.storeDomain)}?niche=${encodeURIComponent(niche)}`}
            className="min-w-0 text-xs text-slate-500 hover:text-brand-300 truncate"
          >
            {product.storeDomain}
          </Link>
          <span
            className="shrink-0 text-[10px] text-slate-600"
            title="This product's store's overall Validation Score — there's no free per-product review/ad data, so ranking here blends the product's own signals with its store's"
          >
            Store {product.storeScore}/100
          </span>
        </div>
      </div>
    </div>
  );
}

export default function WinningProductsFeed({ products, niche }: { products: WinningProduct[]; niche: string }) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
        <p className="text-sm text-slate-400 mb-1">No products with images to show yet.</p>
        <p className="text-xs text-slate-600">Try the Stores view, or a broader keyword.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] text-slate-600 mb-3 flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />
        Ranked by a blend of each product's own evidence (bestseller listing, sold-out share) and
        its store's Validation Score and ad momentum — there's no free per-product review/ad data,
        so this is honestly a blend, not a per-SKU score.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {products.map((p, idx) => (
          <ProductCard key={`${p.storeDomain}-${idx}`} product={p} niche={niche} />
        ))}
      </div>
    </div>
  );
}
