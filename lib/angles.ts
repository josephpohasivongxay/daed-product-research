import type { StoreResult } from './types';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those', 'it', 'its', 'as', 'at', 'by',
  'from', 'into', 'your', 'our', 'their', 'you', 'we', 'they', 'i', 'he', 'she', 'him', 'her',
  'his', 'hers', 'not', 'no', 'yes', 'can', 'will', 'just', 'more', 'most', 'all', 'each', 'has',
  'have', 'had', 'do', 'does', 'did', 'if', 'than', 'then', 'so', 'up', 'out', 'about', 'over',
  'under', 'again', 'new', 'get', 'also', 'which', 'who', 'what', 'when', 'where', 'why', 'how',
  // generic e-commerce noise that isn't a positioning "angle" on its own
  'shop', 'store', 'buy', 'product', 'products', 'item', 'items', 'sale', 'free', 'shipping',
  'order', 'price', 'size', 'color', 'colour', 'set', 'pack', 'edition', 'official',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function buildBigrams(words: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}

/**
 * Surfaces marketing/positioning terms that show up across MULTIPLE
 * relevant stores' product titles/descriptions (already fetched during
 * discovery — no extra requests) — a term one store uses once is that
 * store's own copy, not a common selling angle. Phrases (bigrams) are
 * preferred over single words since they carry more positioning meaning
 * ("eco friendly" vs. just "eco"). Lexical, not semantic — this counts
 * repeated words, it doesn't understand marketing strategy.
 */
export function computeCommonAngles(results: StoreResult[], niche: string, limit = 8): string[] {
  const nicheWords = new Set(tokenize(niche));
  const wordStores = new Map<string, Set<string>>();
  const phraseStores = new Map<string, Set<string>>();

  for (const store of results) {
    const storeWords = new Set<string>();
    const storePhrases = new Set<string>();

    for (const snippet of store.keywordSnippets) {
      const words = tokenize(snippet).filter((w) => !nicheWords.has(w));
      words.forEach((w) => storeWords.add(w));
      buildBigrams(words).forEach((p) => storePhrases.add(p));
    }

    storeWords.forEach((w) => {
      if (!wordStores.has(w)) wordStores.set(w, new Set());
      wordStores.get(w)!.add(store.domain);
    });
    storePhrases.forEach((p) => {
      if (!phraseStores.has(p)) phraseStores.set(p, new Set());
      phraseStores.get(p)!.add(store.domain);
    });
  }

  const rankByStoreCount = (map: Map<string, Set<string>>) =>
    Array.from(map.entries())
      .filter(([, stores]) => stores.size >= 2)
      .sort((a, b) => b[1].size - a[1].size)
      .map(([term]) => term);

  const topPhrases = rankByStoreCount(phraseStores).slice(0, Math.ceil(limit / 2));
  const topWords = rankByStoreCount(wordStores).filter((w) => !topPhrases.some((p) => p.includes(w)));

  return [...topPhrases, ...topWords].slice(0, limit);
}
