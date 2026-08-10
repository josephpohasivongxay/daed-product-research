import type { Popularity } from './types';

/**
 * Tranco (tranco-list.eu) is a free, research-grade top-1M domain
 * popularity ranking — the modern replacement for the defunct Alexa rank,
 * combining several traffic-correlated sources without requiring a paid
 * traffic API. Its documented lookup endpoint is /api/ranks/domain/{domain},
 * but this sandbox's network policy blocks reaching tranco-list.eu to
 * verify the exact response shape, so parsing here is deliberately lenient
 * and this whole call is best-effort: any shape mismatch, timeout, or
 * non-200 response degrades to `null` rather than breaking search.
 */
export async function fetchPopularity(domain: string): Promise<Popularity | null> {
  try {
    const res = await fetch(`https://tranco-list.eu/api/ranks/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json();

    type RankEntry = { rank?: number; date?: string };
    const entries: RankEntry[] = Array.isArray(data?.ranks)
      ? data.ranks
      : Array.isArray(data)
        ? data
        : [];

    const mostRecent = entries
      .filter((e) => typeof e.rank === 'number')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];

    const rank = mostRecent?.rank ?? (typeof data?.rank === 'number' ? data.rank : null);

    return { trancoRank: rank };
  } catch {
    return null;
  }
}
