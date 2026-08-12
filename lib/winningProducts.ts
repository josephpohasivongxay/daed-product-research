import { computeAdMomentumLabel } from './adMomentum';
import type { SampleProduct, StoreResult, WinningProduct } from './types';

const WINNING_PRODUCTS_LIMIT = 24;

/**
 * There's no true per-product review/ad data available for free (Shopify's
 * products.json has no review counts, and Meta's Ad Library is per-Page,
 * not per-SKU) — so "winning-ness" here is an honest blend of what this
 * product itself shows (sold-out share, bestseller-collection listing) and
 * what its STORE shows (validation score, ad momentum). Every displayed
 * product still carries its own real title/price/image/URL; only the
 * ranking signal borrows from the store.
 */
function winScore(product: SampleProduct, store: StoreResult): number {
  let score = store.score.total;
  if (product.isBestseller) score += 15;
  if (product.soldOutRatio !== null) score += product.soldOutRatio * 20;

  const momentum = computeAdMomentumLabel(store.metaAdSummary);
  if (momentum === 'Proven winner') score += 15;
  else if (momentum === 'Scaling') score += 10;
  else if (momentum === 'Testing') score += 5;

  return score;
}

export function computeWinningProducts(results: StoreResult[], limit = WINNING_PRODUCTS_LIMIT): WinningProduct[] {
  const flattened = results.flatMap((store) =>
    store.sampleProducts
      .filter((p) => p.image) // a visual feed needs a real image to be worth showing
      .map((product) => ({ product, store, score: winScore(product, store) }))
  );

  flattened.sort((a, b) => b.score - a.score);

  return flattened.slice(0, limit).map(({ product, store }) => ({
    title: product.title,
    price: product.price,
    image: product.image,
    url: product.url,
    storeDomain: store.domain,
    storeScore: store.score.total,
    soldOutRatio: product.soldOutRatio,
    isBestseller: product.isBestseller,
    adMomentum: computeAdMomentumLabel(store.metaAdSummary),
  }));
}
