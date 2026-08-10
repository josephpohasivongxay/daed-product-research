import type { StoreResult } from './types';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

type ShopifyVariant = { price?: string };
type ShopifyImage = { src?: string };
type ShopifyProduct = {
  title?: string;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
};
type ShopifyProductsResponse = { products?: ShopifyProduct[] };

/**
 * Confirms a domain is an active Shopify store by querying its public
 * products.json endpoint, then normalizes a sample of its catalog.
 * Returns null if the domain doesn't respond or isn't Shopify.
 */
export async function fetchShopifyCatalog(domain: string): Promise<StoreResult | null> {
  try {
    const res = await fetch(`https://${domain}/products.json?limit=6`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
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

    return {
      domain,
      platform: 'shopify',
      productsSample: products.length,
      sampleProducts,
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
