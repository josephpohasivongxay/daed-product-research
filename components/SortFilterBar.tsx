'use client';

import { useState } from 'react';
import { ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { SORT_OPTIONS, type FilterState, type SortKey } from '@/lib/sortFilter';

export default function SortFilterBar({
  sortBy,
  onSortChange,
  filters,
  onFiltersChange,
  resultCount,
  totalCount,
}: {
  sortBy: SortKey;
  onSortChange: (value: SortKey) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  /** Stores left after every active filter, including "validated only". */
  resultCount: number;
  /** Stores found for this search before any filter is applied. */
  totalCount: number;
}) {
  const [showFilters, setShowFilters] = useState(false);
  // "Validated only" has its own dedicated toggle below, so it's not counted
  // as one of the "N filters active" badge — that badge is only for the
  // secondary price/product/age filters in the collapsible panel.
  const activeFilterCount = Object.entries(filters).filter(
    ([key, v]) => key !== 'validatedOnly' && v !== undefined
  ).length;

  function updateFilter(key: keyof FilterState, raw: string) {
    const value = raw === '' ? undefined : Number(raw);
    onFiltersChange({ ...filters, [key]: Number.isNaN(value) ? undefined : value });
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFiltersChange({ ...filters, validatedOnly: !filters.validatedOnly })}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              filters.validatedOnly
                ? 'border-brand-700 bg-brand-950/50 text-brand-300'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
            }`}
            title="Only show stores that clear the Validated bar (score 60+) — real relevance to your search plus real sales/longevity evidence"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Validated only
          </button>
          <p className="text-xs text-slate-500">
            {resultCount} of {totalCount} store{totalCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-700 transition"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-medium text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 grid grid-cols-3 gap-2">
          <label className="text-xs text-slate-500">
            Min avg price
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={filters.minPrice ?? ''}
              onChange={(e) => updateFilter('minPrice', e.target.value)}
              placeholder="$0"
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <label className="text-xs text-slate-500">
            Max avg price
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={filters.maxPrice ?? ''}
              onChange={(e) => updateFilter('maxPrice', e.target.value)}
              placeholder="Any"
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <label className="text-xs text-slate-500">
            Min products
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={filters.minProducts ?? ''}
              onChange={(e) => updateFilter('minProducts', e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>

          <label className="col-span-3 mt-1 inline-flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={filters.establishedOnly ?? false}
              onChange={(e) => onFiltersChange({ ...filters, establishedOnly: e.target.checked || undefined })}
              className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 accent-brand-600"
            />
            Established only (6mo+ domain age)
          </label>

          {activeFilterCount > 0 && (
            <button
              onClick={() => onFiltersChange({ validatedOnly: filters.validatedOnly })}
              className="col-span-3 inline-flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-1"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
