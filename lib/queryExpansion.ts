/**
 * Mechanical query variants — not semantic expansion. True semantic
 * expansion (e.g. "red light therapy" -> "photobiomodulation") needs an
 * LLM call, which costs money and breaks this app's free-first design; a
 * curated synonym dictionary would only cover a handful of niches and
 * silently do nothing for the rest, which is worse than not pretending to
 * do it. These variants instead widen commercial-intent search coverage
 * around the exact phrase the user typed.
 */
export function buildQueryVariants(niche: string): string[] {
  const base = niche.trim();
  if (!base) return [];

  return [
    base,
    `"${base}" shop`,
    `${base} buy online`,
    `${base} store`,
    `"${base}" site:myshopify.com`,
  ];
}
