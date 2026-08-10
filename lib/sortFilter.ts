import type { StoreResult } from './types';

export type SortKey =
  | 'recommended'
  | 'relevance'
  | 'name-asc'
  | 'name-desc'
  | 'date-desc'
  | 'date-asc'
  | 'price-asc'
  | 'price-desc'
  | 'products-desc'
  | 'products-asc'
  | 'revenue-desc'
  | 'revenue-asc'
  | 'soldout-desc'
  | 'soldout-asc';

export const DEFAULT_SORT: SortKey = 'recommended';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'relevance', label: 'Search order' },
  { value: 'date-desc', label: 'Newest activity' },
  { value: 'date-asc', label: 'Oldest activity' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'products-desc', label: 'Most products' },
  { value: 'products-asc', label: 'Fewest products' },
  { value: 'price-desc', label: 'Highest avg. price' },
  { value: 'price-asc', label: 'Lowest avg. price' },
  { value: 'revenue-desc', label: 'Highest est. revenue' },
  { value: 'revenue-asc', label: 'Lowest est. revenue' },
  { value: 'soldout-desc', label: 'Highest sold-out rate' },
  { value: 'soldout-asc', label: 'Lowest sold-out rate' },
];

export type FilterState = {
  minPrice?: number;
  maxPrice?: number;
  minProducts?: number;
  /** Excludes stores confirmed younger than 6 months; unknown-age stores are kept (benefit of the doubt). */
  establishedOnly?: boolean;
};

const ESTABLISHED_MIN_MONTHS = 6;

export function filterStores(stores: StoreResult[], filters: FilterState): StoreResult[] {
  return stores.filter((s) => {
    if (filters.minPrice !== undefined && (!s.priceStats || s.priceStats.avg < filters.minPrice)) {
      return false;
    }
    if (filters.maxPrice !== undefined && (!s.priceStats || s.priceStats.avg > filters.maxPrice)) {
      return false;
    }
    if (filters.minProducts !== undefined && s.productsSample < filters.minProducts) {
      return false;
    }
    if (filters.establishedOnly && s.domainAge && s.domainAge.months < ESTABLISHED_MIN_MONTHS) {
      return false;
    }
    return true;
  });
}

function compareNullableNumbers(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

/**
 * Blends the free signals we have into one "is this worth a look" score:
 * how long the store has been around, how popular its domain is (Tranco),
 * whether it's selling through inventory, how recently it added products,
 * and its rough revenue estimate. None of these alone is reliable, so no
 * single one dominates — this is a ranking heuristic, not a real metric.
 */
function scoreStore(store: StoreResult): number {
  let score = 0;

  if (store.domainAge) {
    score += Math.min(store.domainAge.months / 24, 1) * 30;
  }

  if (store.popularity?.trancoRank != null) {
    score += Math.max(0, 1 - store.popularity.trancoRank / 1_000_000) * 25;
  }

  if (store.soldOutRatio !== null) {
    score += store.soldOutRatio * 20;
  }

  if (store.latestProductAt) {
    const daysSince = (Date.now() - new Date(store.latestProductAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 60) score += 15;
    else if (daysSince <= 180) score += 8;
  }

  if (store.revenue) {
    if (store.revenue.monthly > 50_000) score += 10;
    else if (store.revenue.monthly > 10_000) score += 6;
    else if (store.revenue.monthly > 1_000) score += 3;
  }

  return score;
}

export function sortStores(stores: StoreResult[], sortBy: SortKey): StoreResult[] {
  if (sortBy === 'relevance') return stores;

  const sorted = [...stores];
  const dateValue = (s: StoreResult) => (s.latestProductAt ? new Date(s.latestProductAt).getTime() : null);

  switch (sortBy) {
    case 'recommended':
      sorted.sort((a, b) => scoreStore(b) - scoreStore(a));
      break;
    case 'name-asc':
      sorted.sort((a, b) => a.domain.localeCompare(b.domain));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.domain.localeCompare(a.domain));
      break;
    case 'date-desc':
      sorted.sort((a, b) => compareNullableNumbers(dateValue(a), dateValue(b), -1));
      break;
    case 'date-asc':
      sorted.sort((a, b) => compareNullableNumbers(dateValue(a), dateValue(b), 1));
      break;
    case 'price-asc':
      sorted.sort((a, b) => compareNullableNumbers(a.priceStats?.avg ?? null, b.priceStats?.avg ?? null, 1));
      break;
    case 'price-desc':
      sorted.sort((a, b) => compareNullableNumbers(a.priceStats?.avg ?? null, b.priceStats?.avg ?? null, -1));
      break;
    case 'products-desc':
      sorted.sort((a, b) => b.productsSample - a.productsSample);
      break;
    case 'products-asc':
      sorted.sort((a, b) => a.productsSample - b.productsSample);
      break;
    case 'revenue-desc':
      sorted.sort((a, b) => compareNullableNumbers(a.revenue?.monthly ?? null, b.revenue?.monthly ?? null, -1));
      break;
    case 'revenue-asc':
      sorted.sort((a, b) => compareNullableNumbers(a.revenue?.monthly ?? null, b.revenue?.monthly ?? null, 1));
      break;
    case 'soldout-desc':
      sorted.sort((a, b) => compareNullableNumbers(a.soldOutRatio, b.soldOutRatio, -1));
      break;
    case 'soldout-asc':
      sorted.sort((a, b) => compareNullableNumbers(a.soldOutRatio, b.soldOutRatio, 1));
      break;
  }

  return sorted;
}
