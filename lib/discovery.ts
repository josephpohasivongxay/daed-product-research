import { buildQueryVariants } from './queryExpansion';

const BLOCKED_HOSTS = new Set([
  'amazon.com',
  'ebay.com',
  'etsy.com',
  'walmart.com',
  'facebook.com',
  'instagram.com',
  'pinterest.com',
  'youtube.com',
  'shopify.com',
  'wikipedia.org',
  'reddit.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'duckduckgo.com',
  'bing.com',
  'google.com',
  'tavily.com',
]);

export type DiscoverySource = 'tavily';

export type DiscoveryResult = {
  domains: string[];
  source: DiscoverySource;
};

/**
 * Thrown when Tavily itself can't be reached — missing/invalid API key,
 * non-2xx response, or a network failure. Distinct from "Tavily answered
 * but found nothing for this niche," which is a normal empty result, not
 * an error. The caller (the API route) uses this to show an honest
 * "can't connect" message instead of silently serving fake sample data.
 */
export class DiscoveryUnavailableError extends Error {}

function normalizeDomain(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (!host || !host.includes('.')) return null;
    for (const blocked of BLOCKED_HOSTS) {
      if (host === blocked || host.endsWith(`.${blocked}`)) return null;
    }
    return host;
  } catch {
    return null;
  }
}

function dedupe(domains: string[], limit: number): string[] {
  return Array.from(new Set(domains)).slice(0, limit);
}

/**
 * Tavily's exact response shape couldn't be verified end-to-end against
 * live docs from this build environment (network policy blocks reaching
 * api.tavily.com) — GitHub-hosted SDK source confirmed `results[].url` at
 * minimum, and `results[].title` is expected from Tavily's documented
 * search response, but this is otherwise the same "verify on a live
 * deploy" caveat as the Trends/Tranco integrations. A shape mismatch
 * degrades to zero domains for that call, not a crash.
 */
async function discoverViaTavily(query: string, limit: number): Promise<string[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    throw new DiscoveryUnavailableError('TAVILY_API_KEY is not configured');
  }

  let res: Response;
  try {
    res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: 20,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new DiscoveryUnavailableError(`Failed to reach Tavily: ${(err as Error).message}`);
  }

  if (!res.ok) {
    throw new DiscoveryUnavailableError(`Tavily responded with HTTP ${res.status}`);
  }

  const data = await res.json();
  const items: { url?: string }[] = Array.isArray(data?.results) ? data.results : [];
  const domains = items
    .map((item) => (item.url ? normalizeDomain(item.url) : null))
    .filter((d): d is string => Boolean(d));

  return dedupe(domains, limit);
}

/**
 * Runs the base query, then fans the remaining query variants (shop/buy/
 * site:myshopify.com phrasings) through in parallel, merging and deduping.
 * A failure on the base call is a real connectivity problem and is left
 * to propagate; failures on individual variant calls are treated as
 * best-effort and swallowed, since the base call already proved Tavily is
 * reachable.
 */
async function discoverWithVariants(variants: string[], limit: number): Promise<string[]> {
  const [base, ...rest] = variants;
  const baseDomains = await discoverViaTavily(base, limit);

  const extra = await Promise.all(rest.map((q) => discoverViaTavily(q, limit).catch(() => [])));
  return dedupe([...baseDomains, ...extra.flat()], limit);
}

/**
 * Discovers candidate store domains for a niche keyword via Tavily search.
 * Throws DiscoveryUnavailableError if Tavily can't be reached at all —
 * callers should surface that as a connection error, not silently show
 * stale/sample data. Actual "is this a real store" verification happens
 * downstream by probing each domain's products.json endpoint.
 */
export async function discoverCandidateDomains(niche: string, limit = 30): Promise<DiscoveryResult> {
  const variants = buildQueryVariants(niche);
  const domains = await discoverWithVariants(variants, limit);
  return { domains, source: 'tavily' };
}
