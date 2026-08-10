import type { CommunityMention, CommunitySource } from './types';

const REDDIT_RESULT_CAP = 25;

/**
 * Each entry is one "market" to check for organic mentions of the niche.
 * Reddit's public search.json is unauthenticated and can be rate-limited;
 * Hacker News' Algolia search is an official, generously-limited API.
 * Add another provider by writing a fetch function with this signature and
 * registering it below — nothing else needs to change.
 */
type CommunityProvider = (niche: string) => Promise<CommunityMention | null>;

async function fetchRedditMention(niche: string): Promise<CommunityMention | null> {
  try {
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(niche)}&limit=${REDDIT_RESULT_CAP}&sort=relevance&t=year`,
      {
        headers: {
          'User-Agent': 'daed-product-research/1.0 (community demand signal)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const children: { data?: { permalink?: string } }[] = data.data?.children || [];
    const topPermalink = children[0]?.data?.permalink;

    return {
      source: 'reddit',
      label: 'Reddit',
      count: children.length,
      isApproximate: children.length >= REDDIT_RESULT_CAP,
      topUrl: topPermalink ? `https://www.reddit.com${topPermalink}` : null,
    };
  } catch {
    return null;
  }
}

async function fetchHackerNewsMention(niche: string): Promise<CommunityMention | null> {
  try {
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(niche)}&tags=story`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const hits: { objectID?: string }[] = data.hits || [];
    const count: number = typeof data.nbHits === 'number' ? data.nbHits : hits.length;
    const topId = hits[0]?.objectID;

    return {
      source: 'hackernews',
      label: 'Hacker News',
      count,
      isApproximate: false,
      topUrl: topId ? `https://news.ycombinator.com/item?id=${topId}` : null,
    };
  } catch {
    return null;
  }
}

const PROVIDERS: Record<CommunitySource, CommunityProvider> = {
  reddit: fetchRedditMention,
  hackernews: fetchHackerNewsMention,
};

export const ALL_COMMUNITY_SOURCES = Object.keys(PROVIDERS) as CommunitySource[];

export async function fetchCommunityMentions(
  niche: string,
  sources: CommunitySource[]
): Promise<CommunityMention[]> {
  const validSources = sources.filter((s): s is CommunitySource => s in PROVIDERS);
  const settled = await Promise.allSettled(validSources.map((s) => PROVIDERS[s](niche)));

  return settled
    .filter((r): r is PromiseFulfilledResult<CommunityMention | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((m): m is CommunityMention => m !== null);
}
