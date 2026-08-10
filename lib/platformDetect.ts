import type { Platform } from './types';

export type { Platform };

export type HomepageSignal = {
  platform: Platform;
  confidence: 'high' | 'medium' | 'low';
  title: string;
  description: string;
};

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const SIGNATURES: { platform: Platform; patterns: RegExp[] }[] = [
  { platform: 'shopify', patterns: [/cdn\.shopify\.com/i, /Shopify\.theme/i, /\/cdn\/shop\//i, /shopify-section/i] },
  { platform: 'woocommerce', patterns: [/woocommerce/i, /wp-content\/plugins\/woocommerce/i, /wc-ajax/i] },
  { platform: 'bigcommerce', patterns: [/bigcommerce\.com/i, /cdn\d*\.bigcommerce\.com/i, /stencil-utils/i] },
  { platform: 'magento', patterns: [/Mage\.Cookies/i, /\/static\/version\d+\/frontend\//i, /\bmagento\b/i] },
  { platform: 'wix', patterns: [/wixstatic\.com/i, /\bwix\.com\b/i] },
  { platform: 'squarespace', patterns: [/squarespace\.com/i, /static1\.squarespace\.com/i] },
];

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractMetaDescription(html: string): string {
  const match =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  return match ? match[1].trim() : '';
}

/**
 * Fetches a candidate's homepage once and returns both its platform
 * fingerprint and enough text (title + meta description) to score its
 * relevance to the searched niche — used for candidates that fail the
 * Shopify products.json check, so they aren't just silently dropped.
 * Full product/price extraction is Shopify-only; this is classification +
 * a rough relevance read, not a per-platform product scraper.
 */
export async function fetchHomepageSignal(domain: string): Promise<HomepageSignal> {
  try {
    const res = await fetch(`https://${domain}/`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { platform: 'unknown', confidence: 'low', title: '', description: '' };

    const html = await res.text();
    const title = extractTitle(html);
    const description = extractMetaDescription(html);

    for (const { platform, patterns } of SIGNATURES) {
      const matches = patterns.filter((p) => p.test(html)).length;
      if (matches > 0) {
        return { platform, confidence: matches >= 2 ? 'high' : 'medium', title, description };
      }
    }

    // Real page, no recognized platform fingerprint — likely custom-built.
    return { platform: 'custom', confidence: 'low', title, description };
  } catch {
    return { platform: 'unknown', confidence: 'low', title: '', description: '' };
  }
}
