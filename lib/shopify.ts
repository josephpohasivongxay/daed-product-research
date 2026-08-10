import type { PriceStats, StoreResult } from './types';
import { estimateMonthlyRevenue } from './revenue';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Shopify's storefront products.json caps out at 250 per page.
const CATALOG_SAMPLE_LIMIT = 250;

type ShopifyVariant = { price?: string };
type ShopifyImage = { src?: string };
type ShopifyProduct = {
  title?: string;
  created_at?: string;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
};
type ShopifyProductsResponse = { products?: ShopifyProduct[] };

function computePriceStats(products: ShopifyProduct[]): PriceStats | null {
  const prices = products
    .map((p) => parseFloat(p.variants?.[0]?.price || ''))
    .filter((n) => !Number.isNaN(n));

  if (prices.length === 0) return null;

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
  };
}

function latestCreatedAt(products: ShopifyProduct[]): string | null {
  const dates = products
    .map((p) => (p.created_at ? new Date(p.created_at).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));

  if (dates.length === 0) return null;
  return new Date(Math.max(...dates)).toISOString();
}

/**
 * Confirms a domain is an active Shopify store by querying its public
 * products.json endpoint, then normalizes its catalog into display and
 * sort/filter-ready stats. Returns null if the domain doesn't respond or
 * isn't Shopify.
 */
export async function fetchShopifyCatalog(domain: string): Promise<StoreResult | null> {
  try {
    const res = await fetch(`https://${domain}/products.json?limit=${CATALOG_SAMPLE_LIMIT}`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('json')) return null;

    const data: ShopifyProductsResponse = await res.json();
    const products = data.products;
    if (!Array.isArray(products) || products.length === 0) return null;

    const sampleProducts = products.slice(0, 4).map((p) => ({
      title: p.title || 'Untitled product',
      price: p.variants?.[0]?.price || 'N/A',
      image: p.images?.[0]?.src || '',
    }));

    const priceStats = computePriceStats(products);

    return {
      domain,
      platform: 'shopify',
      productsSample: products.length,
      catalogSizeIsApproximate: products.length >= CATALOG_SAMPLE_LIMIT,
      sampleProducts,
      priceStats,
      latestProductAt: latestCreatedAt(products),
      revenue: estimateMonthlyRevenue(priceStats?.avg ?? null, products.length),
      metaAdLink: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(
        domain
      )}`,
      tiktokAdLink: `https://ads.tiktok.com/business/creativecenter/inspiration/popular/ads/pc/en?period=180&keyword=${encodeURIComponent(
        domain
      )}`,
    };
  } catch {
    return null;
  }
}
