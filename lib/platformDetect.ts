export type Platform = 'shopify' | 'woocommerce' | 'bigcommerce' | 'magento' | 'wix' | 'squarespace' | 'custom' | 'unknown';

export type PlatformDetection = {
  platform: Platform;
  confidence: 'high' | 'medium' | 'low';
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

/**
 * Only called for candidates that already failed the Shopify products.json
 * check — this is classification for market-context ("how many WooCommerce
 * competitors exist too"), not a precursor to full product extraction on
 * other platforms, which would need a separate scraper per platform's data
 * shape and is out of scope for this pass.
 */
export async function detectPlatform(domain: string): Promise<PlatformDetection> {
  try {
    const res = await fetch(`https://${domain}/`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { platform: 'unknown', confidence: 'low' };

    const html = await res.text();

    for (const { platform, patterns } of SIGNATURES) {
      const matches = patterns.filter((p) => p.test(html)).length;
      if (matches > 0) {
        return { platform, confidence: matches >= 2 ? 'high' : 'medium' };
      }
    }

    // Real page, no recognized platform fingerprint — likely custom-built.
    return { platform: 'custom', confidence: 'low' };
  } catch {
    return { platform: 'unknown', confidence: 'low' };
  }
}
