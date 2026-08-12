/**
 * Lexical (not semantic) relevance scoring: does this product actually look
 * like the searched niche, based on title/type/tags/description text
 * matches? This is what lets a store selling 200 unrelated products but
 * mentioning the niche once not outrank a store whose catalog is built
 * around it.
 */
export type RelevanceInput = {
  title: string;
  description?: string;
  productType?: string;
  tags?: string[];
};

export type ScoredItem<T> = { item: T; score: number };

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function scoreText(text: string, phrase: string, words: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  if (phrase && lower.includes(phrase)) score += 3;
  for (const word of words) {
    if (lower.includes(word)) score += 1;
  }
  return score;
}

/**
 * Weaker evidence than product-catalog matching (one homepage, not many
 * product listings), used for candidates that aren't Shopify so we can
 * still tell "genuinely associated with this niche" from "search engine
 * noise" without full product data.
 */
export function scoreHomepageRelevance(title: string, description: string, niche: string): number {
  const phrase = niche.trim().toLowerCase();
  const words = tokenize(niche);
  return scoreText(title, phrase, words) * 2 + scoreText(description, phrase, words);
}

/** Deliberately capped well below what a real product-catalog match could reach — this is thinner evidence. */
export function homepageRelevancePercent(score: number): number {
  return Math.round(Math.min(40, score * 4));
}

export function scoreProduct(input: RelevanceInput, niche: string): number {
  const phrase = niche.trim().toLowerCase();
  const words = tokenize(niche);

  const titleScore = scoreText(input.title, phrase, words) * 2;
  const typeScore = input.productType ? scoreText(input.productType, phrase, words) * 1.5 : 0;
  const tagScore = input.tags?.length ? scoreText(input.tags.join(' '), phrase, words) * 1.5 : 0;
  const descScore = input.description ? scoreText(input.description, phrase, words) * 0.5 : 0;

  return titleScore + typeScore + tagScore + descScore;
}

export function rankProductsByRelevance<T extends RelevanceInput>(
  products: T[],
  niche: string
): ScoredItem<T>[] {
  return products
    .map((item) => ({ item, score: scoreProduct(item, niche) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Blends "what share of the catalog matched" with "how strongly the top
 * matches matched" into one 0-100 figure. A store where 4 of its 6 products
 * are the exact niche item scores higher than a store where 4 of 300
 * products happen to mention it in passing.
 */
/**
 * Relevance is a pass/fail gate, not a score component: above the
 * threshold it has zero further effect on rank (see lib/marketScore.ts).
 * Full-catalog (Shopify) relevance and homepage-only relevance are scored
 * on different ceilings — homepageRelevancePercent caps at 40 since a
 * single homepage is much thinner evidence than an entire product catalog
 * — so each gets its own gate, set to the same proportional bar (60% of
 * that tier's own ceiling) rather than one number that would silently
 * exclude every non-Shopify store.
 */
export const RELEVANCE_GATE_CATALOG = 60;
export const RELEVANCE_GATE_HOMEPAGE = 25;

export function passesRelevanceGate(hasFullCatalog: boolean, relevancePercent: number): boolean {
  return relevancePercent >= (hasFullCatalog ? RELEVANCE_GATE_CATALOG : RELEVANCE_GATE_HOMEPAGE);
}

export function computeStoreRelevancePercent(scored: { score: number }[]): {
  percent: number;
  matchedCount: number;
} {
  if (scored.length === 0) return { percent: 0, matchedCount: 0 };

  const matched = scored.filter((s) => s.score > 0);
  const matchRatioComponent = Math.min(1, matched.length / Math.min(scored.length, 5));

  const topScores = matched.slice(0, 10).map((s) => s.score);
  const avgTopScore = topScores.length ? topScores.reduce((a, b) => a + b, 0) / topScores.length : 0;
  // A product matching the full phrase in its title scores 6 (3 * title weight 2) — treat that as a strong ceiling.
  const strengthComponent = Math.min(1, avgTopScore / 6);

  const percent = Math.round(100 * (0.5 * matchRatioComponent + 0.5 * strengthComponent));
  return { percent, matchedCount: matched.length };
}
