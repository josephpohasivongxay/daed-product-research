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
