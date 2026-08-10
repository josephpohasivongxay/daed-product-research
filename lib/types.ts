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

export type RevenueConfidence = 'high' | 'medium' | 'low';

export type RevenueEstimate = {
  low: number;
  base: number;
  high: number;
  confidence: RevenueConfidence;
  method: string;
};

export type DomainAge = {
  firstSeenDate: string;
  months: number;
  /** 'rdap' = real registration date. 'wayback' = first archive.org capture, a lower-bound proxy. */
  source: 'rdap' | 'wayback';
};

export type Popularity = {
  /** Tranco top-1M rank; null when the domain isn't ranked (best-effort, may be unavailable). */
  trancoRank: number | null;
};

export type TrafficTier = 'very high' | 'high' | 'moderate' | 'low' | 'minimal';

export type TrafficEstimate = {
  monthlyVisitsLow: number;
  /** null = open-ended ("1M+"). */
  monthlyVisitsHigh: number | null;
  tier: TrafficTier;
  method: 'tranco-rank-tier';
};

export type ProductReviews = {
  rating: number | null;
  reviewCount: number | null;
  source: 'json-ld';
};

export type Platform = 'shopify' | 'woocommerce' | 'bigcommerce' | 'magento' | 'wix' | 'squarespace' | 'custom' | 'unknown';

export type StoreScoreBreakdown = {
  demand: number;
  commercialProof: number;
  popularity: number;
  momentum: number;
  monetization: number;
};

export type ScoreLabel = 'Extremely Validated' | 'Highly Validated' | 'Validated' | 'Uncertain' | 'Weak';

export type StoreScore = {
  total: number;
  breakdown: StoreScoreBreakdown;
  label: ScoreLabel;
};

export type StoreResult = {
  domain: string;
  platform: Platform;
  productsSample: number;
  /** True when the sample hit Shopify's page cap (250) — the real catalog may be larger. */
  catalogSizeIsApproximate: boolean;
  sampleProducts: SampleProduct[];
  topProductUrl: string | null;
  /** 0-100 lexical match strength between the catalog and the searched niche. */
  relevancePercent: number;
  relevantProductCount: number;
  priceStats: PriceStats | null;
  /** ISO date of the newest `created_at` seen among sampled products. */
  latestProductAt: string | null;
  revenue: RevenueEstimate | null;
  traffic: TrafficEstimate | null;
  reviews: ProductReviews | null;
  /** Share of sampled variants marked unavailable — a free proxy for sell-through. */
  soldOutRatio: number | null;
  soldOutVariants: number;
  totalVariants: number;
  domainAge: DomainAge | null;
  popularity: Popularity | null;
  score: StoreScore;
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

export type MarketScoreBreakdown = {
  demand: number;
  commercialProof: number;
  competition: number;
  momentum: number;
  monetization: number;
};

export type MarketScore = {
  total: number;
  breakdown: MarketScoreBreakdown;
  label: ScoreLabel;
};

export type MarketEvidence = {
  relevantStoreCount: number;
  highTrafficStoreCount: number;
  wellReviewedStoreCount: number;
  typicalPriceRange: PriceStats | null;
  estimatedCombinedTraffic: { low: number; high: number | null } | null;
  estimatedMarketRevenue: { low: number; high: number; confidence: RevenueConfidence } | null;
  platformBreakdown: Partial<Record<Platform, number>>;
};

export type MarketVerdict = {
  summary: string;
  reasons: string[];
  mainRisk: string;
  opportunity: string;
};

export type PricingGap = {
  clusterLow: PriceStats;
  clusterHigh: PriceStats | null;
  note: string;
};

export type MarketValidation = {
  score: MarketScore;
  evidence: MarketEvidence;
  verdict: MarketVerdict;
  pricingGap: PricingGap | null;
};

export type SearchResponse = {
  success: boolean;
  niche: string;
  source: 'google_cse' | 'brave' | 'duckduckgo' | 'sample_fallback';
  candidatesScanned: number;
  results: StoreResult[];
  demand: DemandSignal;
  market: MarketValidation;
  error?: string;
};
