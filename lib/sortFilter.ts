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
  /** Only stores whose total score clears VALIDATED_MIN_SCORE — on by default so the first thing shown is "relevant and proven," not every tangential match. */
  validatedOnly?: boolean;
};

const ESTABLISHED_MIN_MONTHS = 6;

/** A store already had to clear the relevance gate (lib/relevance.ts) just to appear at all — this bar is about the v4 score itself: real commercial proof, operational health, traffic, catalog investment, and replicability combined. */
export const VALIDATED_MIN_SCORE = 60;

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
    if (filters.validatedOnly && s.score.total < VALIDATED_MIN_SCORE) {
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

export function sortStores(stores: StoreResult[], sortBy: SortKey): StoreResult[] {
  if (sortBy === 'relevance') return stores;

  const sorted = [...stores];
  const dateValue = (s: StoreResult) => (s.latestProductAt ? new Date(s.latestProductAt).getTime() : null);

  switch (sortBy) {
    case 'recommended':
      // Uses the same 0-100 Market Validation Score shown on each store's
      // card (server-computed in lib/marketScore.ts), so the ranking and
      // the badge never disagree with each other.
      sorted.sort((a, b) => b.score.total - a.score.total);
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
      sorted.sort((a, b) => compareNullableNumbers(a.revenue?.base ?? null, b.revenue?.base ?? null, -1));
      break;
    case 'revenue-asc':
      sorted.sort((a, b) => compareNullableNumbers(a.revenue?.base ?? null, b.revenue?.base ?? null, 1));
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
