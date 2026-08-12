import type { AngleFindings, StoreResult } from './types';
import { formatCurrency } from './format';

/**
 * Where this store's average relevant-product price sits against the full
 * set of relevant stores found this search — for spotting an undercut or
 * premium-positioning gap, not for judging whether the price is "good."
 */
function computePricePosition(store: StoreResult, allRelevantPrices: number[]): string {
  const price = store.priceStats?.avg;
  if (price === undefined || price === null || allRelevantPrices.length < 2) {
    return "Not enough relevant-store pricing data yet to place this store's price position.";
  }

  const sorted = [...allRelevantPrices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];

  if (price <= median * 0.85) {
    return `Priced below the typical ${formatCurrency(min)}–${formatCurrency(max)} range for this niche (~${formatCurrency(price)} avg) — an undercut angle, if margins support it.`;
  }
  if (price >= median * 1.3) {
    return `Priced above the typical ${formatCurrency(min)}–${formatCurrency(max)} range for this niche (~${formatCurrency(price)} avg) — premium positioning.`;
  }
  return `Priced within the typical ${formatCurrency(min)}–${formatCurrency(max)} range for this niche (~${formatCurrency(price)} avg).`;
}

/** A short, human-readable version of why the Replicability Flag landed where it did. */
function computeReplicabilityNote(store: StoreResult): string {
  const replicability = store.score.breakdown.replicability;
  const paid = store.paidTrafficIndicator;
  const catalogSize = store.productsSample;

  const parts: string[] = [];
  if (catalogSize > 0) {
    parts.push(
      catalogSize <= 20
        ? `a lean ${catalogSize}-SKU catalog`
        : catalogSize <= 100
          ? `a ${catalogSize}-SKU catalog`
          : 'a large, 100+ SKU catalog'
    );
  } else {
    parts.push('no catalog data available (non-Shopify)');
  }

  if (paid === true) parts.push('active paid ads detected');
  else if (paid === false) parts.push('no active paid ads detected');
  else parts.push('paid-ad activity unchecked');

  if (store.domainAge) {
    parts.push(`${Math.round(store.domainAge.months)} months old`);
  }

  const readout =
    replicability >= 11
      ? 'looks like a realistic model for a bootstrapped operator'
      : replicability >= 6
        ? 'is a mixed model — some parts replicable, some not'
        : 'looks more like a funded/scaled operation than a bootstrapped template';

  return `${parts.join(', ')} — ${readout} (Replicability ${replicability}/15).`;
}

/**
 * Step 3 of the scoring spec: required per-store output for the top 10
 * results of a search, not optional extra credit. reviewGaps pulls
 * negative-but-not-damning (2-3★) review text — the primary way to find a
 * real market-entry angle — sourced only from structured data this tool
 * already fetched, never fabricated; when a store's data source doesn't
 * expose individual review bodies, that's stated plainly instead of
 * inventing a "common complaint."
 */
export function computeAngleFindings(store: StoreResult, allRelevantPrices: number[]): AngleFindings {
  const reviewGaps = store.reviewGapBodies.slice(0, 3);
  return {
    reviewGaps,
    reviewGapsAvailable: reviewGaps.length > 0,
    pricePosition: computePricePosition(store, allRelevantPrices),
    replicabilityNote: computeReplicabilityNote(store),
  };
}
