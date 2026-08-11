import type { MetaAd, MetaAdsSignal } from './types';

const GRAPH_API_VERSION = 'v21.0';
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Meta's Ad Library API is free with no paid tier, but using it requires
 * the account owner to personally verify their identity with Meta
 * (government ID upload, 1-3 business day review) before an access token
 * will work — this is not just "get an API key." Without META_ACCESS_TOKEN
 * set, this returns null and the UI shows a manual-check link instead.
 *
 * Only creative/delivery-date fields are available for regular commercial
 * ads (id, page_name, ad_creative_bodies, ad_delivery_start/stop_time,
 * ad_snapshot_url, publisher_platforms) — spend and impression estimates
 * are restricted to political/social-issue ads under Meta's transparency
 * rules and aren't attempted here.
 */
function guessBrandName(domain: string): string {
  const withoutTld = domain.replace(/\.(com|co|shop|store|net|org|io)(\.[a-z]{2})?$/i, '');
  return withoutTld.replace(/[-_.]+/g, ' ').trim();
}

type AdsArchiveItem = {
  id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  publisher_platforms?: string[];
};

export async function fetchMetaAds(domain: string): Promise<MetaAdsSignal | null> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return null;

  const searchedAs = guessBrandName(domain);
  if (!searchedAs) return null;

  try {
    const params = new URLSearchParams({
      search_terms: searchedAs,
      ad_active_status: 'ACTIVE',
      ad_reached_countries: JSON.stringify(['US']),
      fields:
        'id,page_name,ad_creative_bodies,ad_delivery_start_time,ad_delivery_stop_time,ad_snapshot_url,publisher_platforms',
      limit: '25',
      access_token: token,
    });

    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/ads_archive?${params.toString()}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const items: AdsArchiveItem[] = Array.isArray(data?.data) ? data.data : [];
    const now = Date.now();

    const ads: MetaAd[] = items.map((item) => {
      const startDate = item.ad_delivery_start_time ?? null;
      const daysRunning = startDate ? Math.floor((now - new Date(startDate).getTime()) / MS_PER_DAY) : null;

      return {
        id: item.id ?? '',
        pageName: item.page_name ?? null,
        creativeBody: item.ad_creative_bodies?.[0] ?? null,
        startDate,
        stopDate: item.ad_delivery_stop_time ?? null,
        daysRunning,
        snapshotUrl: item.ad_snapshot_url ?? null,
        platforms: item.publisher_platforms ?? [],
      };
    });

    ads.sort((a, b) => (b.daysRunning ?? -1) - (a.daysRunning ?? -1));

    const runningDays = ads.map((ad) => ad.daysRunning).filter((d): d is number => d !== null);

    return {
      activeCount: ads.length,
      longestRunningDays: runningDays.length ? Math.max(...runningDays) : null,
      ads: ads.slice(0, 10),
      searchedAs,
    };
  } catch {
    return null;
  }
}
