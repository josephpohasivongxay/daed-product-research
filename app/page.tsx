'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Radar, Loader2 } from 'lucide-react';
import StoreCard from '@/components/StoreCard';
import SortFilterBar from '@/components/SortFilterBar';
import DemandPanel from '@/components/DemandPanel';
import MarketValidationPanel from '@/components/MarketValidationPanel';
import TikTokPanel from '@/components/TikTokPanel';
import type { CommunitySource, SearchResponse } from '@/lib/types';
import { filterStores, sortStores, DEFAULT_SORT, type FilterState, type SortKey } from '@/lib/sortFilter';

const RECENT_KEY = 'daed_recent_searches';

const COMMUNITY_OPTIONS: { value: CommunitySource; label: string }[] = [
  { value: 'reddit', label: 'Reddit' },
  { value: 'hackernews', label: 'Hacker News' },
];

function loadRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(niche: string) {
  const current = loadRecentSearches().filter((n) => n.toLowerCase() !== niche.toLowerCase());
  const updated = [niche, ...current].slice(0, 6);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  return updated;
}

const SOURCE_LABEL: Record<SearchResponse['source'], string> = {
  tavily: 'Live search · Tavily',
};

export default function Dashboard() {
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>(DEFAULT_SORT);
  const [filters, setFilters] = useState<FilterState>({});
  const [communitySources, setCommunitySources] = useState<CommunitySource[]>(['reddit', 'hackernews']);

  useEffect(() => {
    setRecent(loadRecentSearches());
  }, []);

  function toggleCommunitySource(source: CommunitySource) {
    setCommunitySources((current) =>
      current.includes(source) ? current.filter((s) => s !== source) : [...current, source]
    );
  }

  async function runSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setSortBy(DEFAULT_SORT);
    setFilters({});

    try {
      const params = new URLSearchParams({ niche: trimmed, community: communitySources.join(',') });
      const res = await fetch(`/api/search?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Something went wrong');
        setData(null);
      } else {
        setData(json);
        setRecent(saveRecentSearch(trimmed));
      }
    } catch (err) {
      setError('Network error — please try again');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(niche);
  }

  const results = data?.results || [];
  const visibleResults = useMemo(
    () => sortStores(filterStores(results, filters), sortBy),
    [results, filters, sortBy]
  );

  return (
    <main className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 pt-5 pb-4 sm:pt-6 sm:pb-5">
          <div className="flex items-center gap-2 mb-1">
            <Radar className="h-5 w-5 text-brand-400" />
            <span className="text-sm font-semibold tracking-wide text-slate-400">daed</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-50 mb-1">Market Intelligence</h1>
          <p className="text-sm text-slate-500 mb-4">
            Search a niche to see who's selling it, how strong the evidence of demand is, and
            whether the market's worth entering.
          </p>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Enter a niche, e.g. portable ice bath"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60 transition shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? 'Scanning' : 'Validate market'}
            </button>
          </form>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-600">Check demand in:</span>
            {COMMUNITY_OPTIONS.map((opt) => {
              const active = communitySources.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleCommunitySource(opt.value)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    active
                      ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                      : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {recent.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none">
              {recent.map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setNiche(term);
                    runSearch(term);
                  }}
                  className="shrink-0 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-700 transition"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-5">
        {error && (
          <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300 mb-6">
            {error}
          </div>
        )}

        {data && !error && (
          <p className="text-xs text-slate-500 mb-4">
            {SOURCE_LABEL[data.source]} · scanned {data.candidatesScanned} candidate
            {data.candidatesScanned === 1 ? '' : 's'} for &ldquo;{data.niche}&rdquo;
          </p>
        )}

        {data && !error && <MarketValidationPanel market={data.market} niche={data.niche} />}

        {data && !error && <DemandPanel demand={data.demand} niche={data.niche} />}

        {data && !error && <TikTokPanel niche={data.niche} />}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mb-3" />
            <p className="text-sm">Scanning candidate stores for live catalogs&hellip;</p>
          </div>
        )}

        {!loading && hasSearched && !error && results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
            <p className="text-sm text-slate-400 mb-1">No stores with a clear association to this niche were found.</p>
            <p className="text-xs text-slate-600">Try a broader or differently worded keyword.</p>
          </div>
        )}

        {!loading && !hasSearched && (
          <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
            <Radar className="h-8 w-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-1">Search a niche to build your catalog.</p>
            <p className="text-xs text-slate-600">
              We verify each store live via its public products.json feed.
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <SortFilterBar
              sortBy={sortBy}
              onSortChange={setSortBy}
              filters={filters}
              onFiltersChange={setFilters}
              resultCount={visibleResults.length}
            />

            {sortBy === 'recommended' && (
              <p className="text-[11px] text-slate-600 -mt-3 mb-4">
                Recommended sorts by each store's Validation Score (the badge on its card) —
                relevance, reviews, sold-out rate, popularity, and recent activity combined.
              </p>
            )}

            {visibleResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
                <p className="text-sm text-slate-400 mb-1">No stores match these filters.</p>
                <p className="text-xs text-slate-600">Try widening your price or product-count range.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {visibleResults.map((store) => (
                  <StoreCard key={store.domain} store={store} niche={data!.niche} />
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-600 mt-6">
              * Est. revenue and traffic are rough estimates derived from public signals (Tranco
              rank, pricing) — not real sales or analytics data. Treat every number here as
              evidence to investigate further, not a verified fact.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
