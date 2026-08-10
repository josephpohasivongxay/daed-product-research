'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { SORT_OPTIONS, type FilterState, type SortKey } from '@/lib/sortFilter';

export default function SortFilterBar({
  sortBy,
  onSortChange,
  filters,
  onFiltersChange,
  resultCount,
}: {
  sortBy: SortKey;
  onSortChange: (value: SortKey) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  resultCount: number;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined).length;

  function updateFilter(key: keyof FilterState, raw: string) {
    const value = raw === '' ? undefined : Number(raw);
    onFiltersChange({ ...filters, [key]: Number.isNaN(value) ? undefined : value });
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs text-slate-500">
          {resultCount} store{resultCount === 1 ? '' : 's'}
        </p>
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
              onClick={() => onFiltersChange({})}
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
