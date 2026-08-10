import type { StoreResult } from './types';

export type SortKey =
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
  | 'revenue-asc';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
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
];

export type FilterState = {
  minPrice?: number;
  maxPrice?: number;
  minProducts?: number;
};

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
  }

  return sorted;
}
