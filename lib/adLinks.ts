export function buildAdLinks(domain: string): { metaAdLink: string; tiktokAdLink: string } {
  return {
    metaAdLink: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(
      domain
    )}`,
    tiktokAdLink: `https://ads.tiktok.com/business/creativecenter/inspiration/popular/ads/pc/en?period=180&keyword=${encodeURIComponent(
      domain
    )}`,
  };
}
