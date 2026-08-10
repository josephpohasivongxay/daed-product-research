import type { ProductReviews } from './types';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Most Shopify review apps (Judge.me, Loox, Yotpo, Ali Reviews, ...) inject
 * schema.org Product/AggregateRating JSON-LD into the product page for SEO
 * rich-snippets — reading that is a free, app-agnostic way to get review
 * counts/ratings without integrating each app's own API individually.
 * Reviews are a commercial-activity signal, not a sales figure.
 */
function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // skip malformed block
    }
  }
  return blocks;
}

type JsonNode = Record<string, unknown>;

function findAggregateRating(node: unknown): JsonNode | null {
  if (!node || typeof node !== 'object') return null;
  const obj = node as JsonNode;

  const type = obj['@type'];
  const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
  if (isProduct && obj.aggregateRating && typeof obj.aggregateRating === 'object') {
    return obj.aggregateRating as JsonNode;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findAggregateRating(item);
      if (found) return found;
    }
  }
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph'] as unknown[]) {
      const found = findAggregateRating(item);
      if (found) return found;
    }
  }
  return null;
}

function toNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

async function fetchProductReviews(productUrl: string): Promise<ProductReviews | null> {
  try {
    const res = await fetch(productUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    for (const block of extractJsonLdBlocks(html)) {
      const rating = findAggregateRating(block);
      if (rating) {
        return {
          rating: toNumber(rating.ratingValue),
          reviewCount: toNumber(rating.reviewCount),
          source: 'json-ld',
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Tries candidate product URLs in order (cheapest first), stopping at the first hit. */
export async function fetchBestAvailableReviews(productUrls: string[]): Promise<ProductReviews | null> {
  for (const url of productUrls) {
    const result = await fetchProductReviews(url);
    if (result && (result.reviewCount !== null || result.rating !== null)) return result;
  }
  return null;
}
