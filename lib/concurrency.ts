/**
 * Runs `fn` over `items` with at most `limit` in flight at once, settling
 * every call (a rejection becomes `{ status: 'rejected' }`, matching
 * Promise.allSettled) rather than aborting the whole batch. Store
 * enrichment now does several direct fetches per candidate (products.json,
 * review pages, bestseller collection, domain age, popularity, optionally
 * Meta Ads) — running all of them fully in parallel across ~30 candidates
 * at once would fan out to well over a hundred concurrent requests.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        const value = await fn(items[index], index);
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
