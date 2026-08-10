import { buildQueryVariants } from './queryExpansion';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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
]);

export type DiscoverySource = 'google_cse' | 'brave' | 'duckduckgo' | 'sample_fallback';

export type DiscoveryResult = {
  domains: string[];
  source: DiscoverySource;
};

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

async function discoverViaGoogleCse(query: string, limit: number): Promise<string[]> {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return [];

  const endpoint = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(
    key
  )}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=10`;

  const res = await fetch(endpoint, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];

  const data = await res.json();
  const items: { link?: string }[] = data.items || [];
  const domains = items
    .map((item) => (item.link ? normalizeDomain(item.link) : null))
    .filter((d): d is string => Boolean(d));

  return dedupe(domains, limit);
}

async function discoverViaBrave(query: string, limit: number): Promise<string[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return [];

  const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;

  const res = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': key,
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];

  const data = await res.json();
  const items: { url?: string }[] = data.web?.results || [];
  const domains = items
    .map((item) => (item.url ? normalizeDomain(item.url) : null))
    .filter((d): d is string => Boolean(d));

  return dedupe(domains, limit);
}

function extractDomainsFromHtml(html: string, linkPattern: RegExp): string[] {
  const domains: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    let href = match[1];

    // DuckDuckGo wraps results as /l/?uddg=<encoded-target>
    const uddgMatch = href.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      href = decodeURIComponent(uddgMatch[1]);
    }
    if (href.startsWith('//')) href = `https:${href}`;

    const domain = normalizeDomain(href);
    if (domain) domains.push(domain);
  }
  return domains;
}

async function discoverViaDuckDuckGo(query: string, limit: number): Promise<string[]> {
  const headers = {
    'User-Agent': BROWSER_UA,
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const html = await res.text();
      const domains = extractDomainsFromHtml(html, /class="result__a"[^>]*href="([^"]+)"/g);
      const deduped = dedupe(domains, limit);
      if (deduped.length > 0) return deduped;
    }
  } catch {
    // try lite endpoint next
  }

  try {
    const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const html = await res.text();
      const domains = extractDomainsFromHtml(html, /<a[^>]*rel="nofollow"[^>]*href="([^"]+)"/g);
      return dedupe(domains, limit);
    }
  } catch {
    // give up, caller falls back to sample data
  }

  return [];
}

/**
 * Runs the base query through a provider, and — only if that succeeds —
 * fans the remaining query variants (shop/buy/site:myshopify.com phrasings)
 * through the same provider in parallel, merging and deduping results.
 * Variants only fire once we know the provider is working, so a dead
 * provider (e.g. unconfigured API key, or DDG mid-rate-limit) doesn't burn
 *4x the requests for nothing.
 */
async function discoverWithVariants(
  variants: string[],
  fetchOne: (query: string, limit: number) => Promise<string[]>,
  limit: number
): Promise<string[]> {
  const [base, ...rest] = variants;
  const baseDomains = await fetchOne(base, limit);
  if (baseDomains.length === 0) return [];

  const extra = await Promise.all(rest.map((q) => fetchOne(q, limit).catch(() => [])));
  return dedupe([...baseDomains, ...extra.flat()], limit);
}

/**
 * Discovers candidate store domains for a niche keyword, trying providers in
 * order of reliability: Google Custom Search and Brave Search (official JSON
 * APIs, opt-in via env vars) before a best-effort DuckDuckGo HTML scrape,
 * which search engines can rate-limit or block from shared serverless IPs.
 * Actual "is this a real store" verification happens downstream by probing
 * each domain's products.json endpoint.
 */
export async function discoverCandidateDomains(
  niche: string,
  limit = 20
): Promise<DiscoveryResult> {
  const variants = buildQueryVariants(niche);

  try {
    const googleDomains = await discoverWithVariants(variants, discoverViaGoogleCse, limit);
    if (googleDomains.length > 0) {
      return { domains: googleDomains, source: 'google_cse' };
    }
  } catch {
    // fall through to next provider
  }

  try {
    const braveDomains = await discoverWithVariants(variants, discoverViaBrave, limit);
    if (braveDomains.length > 0) {
      return { domains: braveDomains, source: 'brave' };
    }
  } catch {
    // fall through to next provider
  }

  try {
    // Only 2 variants for DDG — each is a scrape, and firing 4 in parallel
    // at an already rate-limit-prone endpoint is more likely to get the
    // whole search blocked than to find more candidates.
    const ddgDomains = await discoverWithVariants(variants.slice(0, 2), discoverViaDuckDuckGo, limit);
    if (ddgDomains.length > 0) {
      return { domains: ddgDomains, source: 'duckduckgo' };
    }
  } catch {
    // fall through to sample fallback
  }

  return { domains: [], source: 'sample_fallback' };
}
