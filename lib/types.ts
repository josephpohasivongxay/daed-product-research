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
  /** Share of sampled variants marked unavailable — a free proxy for sell-through. */
  soldOutRatio: number | null;
  soldOutVariants: number;
  totalVariants: number;
  metaAdLink: string;
  tiktokAdLink: string;
};

export type TrendPoint = {
  date: string;
  value: number;
};

export type TrendSignal = {
  status: 'rising' | 'steady' | 'falling';
  points: TrendPoint[];
};

export type CommunitySource = 'reddit' | 'hackernews';

export type CommunityMention = {
  source: CommunitySource;
  label: string;
  count: number;
  /** True when `count` hit the provider's result cap — the real total may be higher. */
  isApproximate: boolean;
  topUrl: string | null;
};

export type DemandSignal = {
  trend: TrendSignal | null;
  community: CommunityMention[];
};

export type SearchResponse = {
  success: boolean;
  niche: string;
  source: 'google_cse' | 'brave' | 'duckduckgo' | 'sample_fallback';
  candidatesScanned: number;
  results: StoreResult[];
  demand: DemandSignal;
  error?: string;
};
