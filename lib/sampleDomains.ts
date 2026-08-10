/**
 * Used only when live discovery (Google CSE / DuckDuckGo) returns zero
 * candidates, e.g. the scraper gets rate-limited. Keeps the MVP demo-able
 * rather than returning an empty result.
 */
export const SAMPLE_FALLBACK_DOMAINS = [
  'gymshark.com',
  'allbirds.com',
  'chubbiesshorts.com',
  'brooklinen.com',
  'mejuri.com',
  'kylie-cosmetics.myshopify.com',
];
