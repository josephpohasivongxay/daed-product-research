export type SampleProduct = {
  title: string;
  price: string;
  image: string;
};

export type PriceStats = {
  min: number;
  max: number;
  avg: number;
};

export type RevenueEstimate = {
  monthly: number;
  /** 'heuristic' = rough, clearly-labeled guess. 'provider' reserved for a real paid data source. */
  source: 'heuristic' | 'provider';
};

export type StoreResult = {
  domain: string;
  platform: 'shopify';
  productsSample: number;
  /** True when the sample hit Shopify's page cap (250) — the real catalog may be larger. */
  catalogSizeIsApproximate: boolean;
  sampleProducts: SampleProduct[];
  priceStats: PriceStats | null;
  /** ISO date of the newest `created_at` seen among sampled products. */
  latestProductAt: string | null;
  revenue: RevenueEstimate | null;
  metaAdLink: string;
  tiktokAdLink: string;
};

export type SearchResponse = {
  success: boolean;
  niche: string;
  source: 'google_cse' | 'brave' | 'duckduckgo' | 'sample_fallback';
  candidatesScanned: number;
  results: StoreResult[];
  error?: string;
};
