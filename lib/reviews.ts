import type { ProductReviews } from './types';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const RECENT_REVIEW_WINDOW_DAYS = 90;

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

/** Returns the Product node itself (not just its aggregateRating) so callers can also read its `review[]` array for recency. */
function findProductWithRating(node: unknown): JsonNode | null {
  if (!node || typeof node !== 'object') return null;
  const obj = node as JsonNode;

  const type = obj['@type'];
  const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
  if (isProduct && obj.aggregateRating && typeof obj.aggregateRating === 'object') {
    return obj;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductWithRating(item);
      if (found) return found;
    }
  }
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph'] as unknown[]) {
      const found = findProductWithRating(item);
      if (found) return found;
    }
  }
  return null;
}

function toNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Counts how many of a Product node's individual `review[]` entries (when
 * present — most stores only expose the aggregate, not each review) fall
 * within the recency window. Recent reviews are stronger "selling now"
 * evidence than a large but possibly-stale total count. Returns null (not
 * 0) when no dated reviews were present at all, since that's a data-
 * availability gap, not evidence of zero recent activity.
 */
function countRecentReviews(productNode: JsonNode, days: number): number | null {
  const raw = productNode.review;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : null;
  if (!list || list.length === 0) return null;

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let count = 0;
  let anyDated = false;
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const date = (entry as JsonNode).datePublished;
    if (typeof date === 'string') {
      const t = new Date(date).getTime();
      if (!Number.isNaN(t)) {
        anyDated = true;
        if (t >= cutoff) count++;
      }
    }
  }
  return anyDated ? count : null;
}

/** Pulls 2-3★ review bodies from a Product node's `review[]` array, when present — used for gap-mining, never fabricated. */
function extractLowStarReviewBodies(productNode: JsonNode, max = 5): string[] {
  const raw = productNode.review;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const bodies: string[] = [];

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const node = entry as JsonNode;
    const ratingNode = node.reviewRating as JsonNode | undefined;
    const rating = ratingNode ? toNumber(ratingNode.ratingValue) : null;
    const body = typeof node.reviewBody === 'string' ? node.reviewBody.trim() : '';
    if (rating !== null && rating >= 2 && rating <= 3 && body) {
      bodies.push(body.length > 240 ? `${body.slice(0, 240)}…` : body);
    }
    if (bodies.length >= max) break;
  }
  return bodies;
}

/**
 * Data-attribute patterns that Judge.me, Loox, and Stamped commonly render
 * server-side into the page's initial HTML (for their own preview badges),
 * independent of the JSON-LD rich-snippet block. This reads already-public,
 * already-rendered markup — no app API tokens or undocumented endpoints
 * involved. Best-effort: theme integrations vary, and some only render via
 * client-side JS with no server-rendered fallback, in which case this
 * (correctly) finds nothing and the caller falls through to null.
 */
function findTagChunk(html: string, marker: RegExp, windowSize: number): string | null {
  const idx = html.search(marker);
  if (idx === -1) return null;
  return html.slice(idx, idx + windowSize);
}

function extractAttr(chunk: string, attr: string): string | null {
  const match = chunk.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'));
  return match ? match[1] : null;
}

function extractWidgetEmbedFallback(html: string): ProductReviews | null {
  // Judge.me preview badge: <div class="jdgm-prev-badge" data-average-rating="4.8" data-number-of-reviews="120" ...>
  const jdgm = findTagChunk(html, /jdgm-prev-badge/i, 400);
  if (jdgm) {
    const rating = toNumber(extractAttr(jdgm, 'data-average-rating'));
    const reviewCount = toNumber(extractAttr(jdgm, 'data-number-of-reviews'));
    if (rating !== null || reviewCount !== null) {
      return { rating, reviewCount, recentReviewCount: null, source: 'widget-embed' };
    }
  }

  // Loox: <div id="looxReviews" ... data-rating="4.7" data-raters="89" ...> (attribute naming varies by theme integration)
  const loox = findTagChunk(html, /loox-reviews-summary|id=["']looxReviews["']/i, 600);
  if (loox) {
    const rating = toNumber(extractAttr(loox, 'data-rating') ?? extractAttr(loox, 'data-avg-rating'));
    const reviewCount = toNumber(
      extractAttr(loox, 'data-raters') ?? extractAttr(loox, 'data-num-reviews') ?? extractAttr(loox, 'data-reviews')
    );
    if (rating !== null || reviewCount !== null) {
      return { rating, reviewCount, recentReviewCount: null, source: 'widget-embed' };
    }
  }

  // Stamped.io: <div class="stamped-product-reviews-badge" data-rating="4.5" data-reviews-count="34" ...>
  const stamped = findTagChunk(html, /stamped-product-reviews-badge/i, 400);
  if (stamped) {
    const rating = toNumber(extractAttr(stamped, 'data-rating'));
    const reviewCount = toNumber(extractAttr(stamped, 'data-reviews-count') ?? extractAttr(stamped, 'data-review-count'));
    if (rating !== null || reviewCount !== null) {
      return { rating, reviewCount, recentReviewCount: null, source: 'widget-embed' };
    }
  }

  return null;
}

/** "N sold" / "N+ sold recently" / "N people bought this" style badge text — theme-native bestseller badges or apps like Fomo/Sales Pop that render server-side. Purely a text scan of HTML already fetched for reviews, no extra request. */
const SOLD_BADGE_PATTERN = /\b\d{1,3}(?:[,.]\d{3})*\+?\s*(?:sold|purchased|bought)\b/i;

export type ProductPageEvidence = {
  reviews: ProductReviews | null;
  reviewGapBodies: string[];
  hasSoldCountBadge: boolean;
};

async function fetchProductPageEvidence(productUrl: string): Promise<ProductPageEvidence | null> {
  try {
    const res = await fetch(productUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const html = await res.text();

    let reviews: ProductReviews | null = null;
    let reviewGapBodies: string[] = [];
    for (const block of extractJsonLdBlocks(html)) {
      const productNode = findProductWithRating(block);
      if (productNode) {
        const rating = productNode.aggregateRating as JsonNode;
        reviews = {
          rating: toNumber(rating.ratingValue),
          reviewCount: toNumber(rating.reviewCount),
          recentReviewCount: countRecentReviews(productNode, RECENT_REVIEW_WINDOW_DAYS),
          source: 'json-ld',
        };
        reviewGapBodies = extractLowStarReviewBodies(productNode);
        break;
      }
    }

    if (!reviews) {
      reviews = extractWidgetEmbedFallback(html);
    }

    return { reviews, reviewGapBodies, hasSoldCountBadge: SOLD_BADGE_PATTERN.test(html) };
  } catch {
    return null;
  }
}

/**
 * Checks candidate product URLs concurrently (not sequentially — with a
 * 5s timeout per page, three misses in a row would otherwise cost up to
 * 15s for a single store), then merges evidence in URL priority order:
 * the first (in the original, cheapest-first order) page with real review
 * data wins for rating/count, but a sold-count badge or gap-mining text
 * found on ANY checked page still counts — different product pages on the
 * same store often carry different partial evidence.
 */
export async function fetchBestAvailableEvidence(productUrls: string[]): Promise<ProductPageEvidence> {
  const pageResults = await Promise.all(productUrls.map((url) => fetchProductPageEvidence(url)));

  let reviews: ProductReviews | null = null;
  let reviewGapBodies: string[] = [];
  let hasSoldCountBadge = false;

  for (const result of pageResults) {
    if (!result) continue;

    if (!reviews && result.reviews && (result.reviews.reviewCount !== null || result.reviews.rating !== null)) {
      reviews = result.reviews;
      reviewGapBodies = result.reviewGapBodies;
    }
    if (result.hasSoldCountBadge) hasSoldCountBadge = true;
  }

  return { reviews, reviewGapBodies, hasSoldCountBadge };
}
