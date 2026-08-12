import type { PriceStats, SampleProduct } from './types';
import { rankProductsByRelevance, computeStoreRelevancePercent } from './relevance';
import { buildAdLinks } from './adLinks';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Shopify's storefront products.json caps out at 250 per page.
const CATALOG_SAMPLE_LIMIT = 250;
const RELEVANT_PRODUCT_DISPLAY_COUNT = 4;

type ShopifyVariant = { price?: string; available?: boolean };
type ShopifyImage = { src?: string };
type ShopifyProduct = {
  title?: string;
  body_html?: string;
  product_type?: string;
  tags?: string[] | string;
  handle?: string;
  created_at?: string;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
};
type ShopifyProductsResponse = { products?: ShopifyProduct[] };

/** Catalog data derived purely from products.json — no domain age / popularity yet. */
export type ShopifyCatalogData = {
  domain: string;
  platform: 'shopify';
  productsSample: number;
  catalogSizeIsApproximate: boolean;
  sampleProducts: SampleProduct[];
  /** Best relevant product page URLs, used for review extraction. */
  topProductUrls: string[];
  /** Title + short description snippet of top relevant products, for niche-wide selling-angle extraction. */
  keywordSnippets: string[];
  relevancePercent: number;
  relevantProductCount: number;
  priceStats: PriceStats | null;
  latestProductAt: string | null;
  soldOutRatio: number | null;
  soldOutVariants: number;
  totalVariants: number;
  metaAdLink: string;
  tiktokAdLink: string;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function productTags(product: ShopifyProduct): string[] {
  if (Array.isArray(product.tags)) return product.tags;
  if (typeof product.tags === 'string') return product.tags.split(',').map((t) => t.trim());
  return [];
}

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

function computeSoldOutStats(products: ShopifyProduct[]): {
  ratio: number | null;
  soldOut: number;
  total: number;
} {
  const variants = products.flatMap((p) => p.variants || []);
  // `available` isn't guaranteed to be present on every storefront theme's feed.
  const trackedVariants = variants.filter((v) => typeof v.available === 'boolean');

  if (trackedVariants.length === 0) {
    return { ratio: null, soldOut: 0, total: 0 };
  }

  const soldOut = trackedVariants.filter((v) => v.available === false).length;
  return { ratio: soldOut / trackedVariants.length, soldOut, total: trackedVariants.length };
}

/**
 * Confirms a domain is an active Shopify store by querying its public
 * products.json endpoint, then normalizes its catalog into display and
 * sort/filter-ready stats — ranked and filtered by relevance to the
 * searched niche rather than an arbitrary first-N slice. Returns null if
 * the domain doesn't respond or isn't Shopify.
 */
export async function fetchShopifyCatalog(domain: string, niche: string): Promise<ShopifyCatalogData | null> {
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

    const ranked = rankProductsByRelevance(
      products.map((p) => ({
        product: p,
        title: p.title || '',
        description: p.body_html || '',
        productType: p.product_type,
        tags: productTags(p),
      })),
      niche
    );
    const { percent: relevancePercent, matchedCount: relevantProductCount } = computeStoreRelevancePercent(
      ranked.map((r) => ({ score: r.score }))
    );

    // Prefer relevant products for both display and pricing; fall back to
    // the raw catalog when nothing matched so the store still shows up
    // (just ranked low via its relevancePercent) rather than empty-handed.
    const pricingPool = relevantProductCount > 0 ? ranked.slice(0, relevantProductCount).map((r) => r.item.product) : products;
    const displayPool = relevantProductCount > 0 ? ranked.map((r) => r.item.product) : products;

    const sampleProducts = displayPool.slice(0, RELEVANT_PRODUCT_DISPLAY_COUNT).map((p) => ({
      title: p.title || 'Untitled product',
      price: p.variants?.[0]?.price || 'N/A',
      image: p.images?.[0]?.src || '',
    }));

    const topProductUrls = displayPool
      .slice(0, 3)
      .filter((p) => p.handle)
      .map((p) => `https://${domain}/products/${p.handle}`);

    const keywordSnippets = displayPool.slice(0, 3).map((p) => {
      const title = p.title || '';
      const description = p.body_html ? stripHtml(p.body_html).slice(0, 200) : '';
      return [title, description].filter(Boolean).join('. ');
    });

    const priceStats = computePriceStats(pricingPool);
    const soldOutStats = computeSoldOutStats(products);

    return {
      domain,
      platform: 'shopify',
      productsSample: products.length,
      catalogSizeIsApproximate: products.length >= CATALOG_SAMPLE_LIMIT,
      sampleProducts,
      topProductUrls,
      keywordSnippets,
      relevancePercent,
      relevantProductCount,
      priceStats,
      latestProductAt: latestCreatedAt(products),
      soldOutRatio: soldOutStats.ratio,
      soldOutVariants: soldOutStats.soldOut,
      totalVariants: soldOutStats.total,
      ...buildAdLinks(domain),
    };
  } catch {
    return null;
  }
}
