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
]);

export type DiscoverySource = 'google_cse' | 'duckduckgo' | 'sample_fallback';

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

async function discoverViaGoogleCse(niche: string, limit: number): Promise<string[]> {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return [];

  const query = `${niche} shop online store`;
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

async function discoverViaDuckDuckGo(niche: string, limit: number): Promise<string[]> {
  const query = `${niche} shop buy online -site:amazon.com -site:etsy.com -site:ebay.com`;
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(endpoint, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];

  const html = await res.text();
  const domains: string[] = [];

  const linkPattern = /class="result__a"[^>]*href="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    let href = match[1];

    // DuckDuckGo's HTML endpoint wraps results as /l/?uddg=<encoded-target>
    const uddgMatch = href.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      href = decodeURIComponent(uddgMatch[1]);
    }

    const domain = normalizeDomain(href);
    if (domain) domains.push(domain);
  }

  return dedupe(domains, limit);
}

/**
 * Discovers candidate store domains for a niche keyword.
 * Tries Google Custom Search (if configured), then falls back to a free
 * DuckDuckGo HTML scrape. Actual "is this a real store" verification
 * happens downstream by probing each domain's products.json endpoint.
 */
export async function discoverCandidateDomains(
  niche: string,
  limit = 12
): Promise<DiscoveryResult> {
  try {
    const googleDomains = await discoverViaGoogleCse(niche, limit);
    if (googleDomains.length > 0) {
      return { domains: googleDomains, source: 'google_cse' };
    }
  } catch {
    // fall through to next provider
  }

  try {
    const ddgDomains = await discoverViaDuckDuckGo(niche, limit);
    if (ddgDomains.length > 0) {
      return { domains: ddgDomains, source: 'duckduckgo' };
    }
  } catch {
    // fall through to sample fallback
  }

  return { domains: [], source: 'sample_fallback' };
}
