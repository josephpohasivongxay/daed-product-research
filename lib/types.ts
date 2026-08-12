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

export type MetaAd = {
  id: string;
  pageName: string | null;
  creativeBody: string | null;
  /** ISO date the ad started running. */
  startDate: string | null;
  /** null = still active. */
  stopDate: string | null;
  daysRunning: number | null;
  snapshotUrl: string | null;
  platforms: string[];
};

export type MetaAdsSignal = {
  activeCount: number;
  longestRunningDays: number | null;
  /** Longest-running ads first — a long-running ad is a stronger "this is working" signal than a fresh one. */
  ads: MetaAd[];
  /** The brand name guessed from the domain and searched against — matches aren't guaranteed. */
  searchedAs: string;
};

export type Platform = 'shopify' | 'woocommerce' | 'bigcommerce' | 'magento' | 'wix' | 'squarespace' | 'custom' | 'unknown';

export type StoreScoreBreakdown = {
  /** Reviews + sold-out rate + traffic — direct evidence people buy here. */
  salesEvidence: number;
  /** Domain age + recent catalog activity — a real, ongoing operation, not proof of sales by itself. */
  longevity: number;
  /** Lexical match strength to the searched niche — a gate, not a demand signal. */
  relevance: number;
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
  /** Title + short description text of top relevant products (or homepage title/description for non-Shopify), for niche-wide selling-angle extraction. */
  keywordSnippets: string[];
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
  /** Recurring marketing/positioning terms across relevant stores' product copy — lexical, not semantic. */
  commonAngles: string[];
};

export type TamSizeLabel = 'Small' | 'Medium' | 'Large';
export type CaptureRateLabel = 'Low' | 'Moderate' | 'High';

export type TamSamSom = {
  /** Annualized $, bottom-up from discovered-market revenue — not a published industry figure. */
  tam: number;
  sam: number;
  som: number;
  tamLabel: TamSizeLabel;
  somCaptureRate: number;
  somCaptureLabel: CaptureRateLabel;
  coverageMultiplier: number;
  assumptions: string[];
};

export type DemandMomentumLabel = 'Cooling' | 'Steady' | 'Rising';

export type DemandFit = {
  label: DemandMomentumLabel;
  note: string;
};

export type CompetitiveLandscapeLabel = 'Open' | 'Competitive' | 'Saturated';

export type CompetitiveFit = {
  label: CompetitiveLandscapeLabel;
  wedge: string | null;
};

export type WillingnessToPayLabel = 'Weak' | 'Moderate' | 'Strong';

export type WillingnessToPayFit = {
  label: WillingnessToPayLabel;
  priceRangeNote: string | null;
  evidenceNotes: string[];
};

export type MarketFitVerdictLabel = 'Ship' | 'Tweak' | 'Kill';

export type MarketFitVerdict = {
  verdict: MarketFitVerdictLabel;
  reasoning: string[];
};

export type MarketFit = {
  tamSamSom: TamSamSom | null;
  demand: DemandFit;
  competitive: CompetitiveFit;
  willingnessToPay: WillingnessToPayFit;
  verdict: MarketFitVerdict;
};

export type SearchResponse = {
  success: boolean;
  niche: string;
  source: 'tavily';
  candidatesScanned: number;
  results: StoreResult[];
  demand: DemandSignal;
  market: MarketValidation;
  marketFit: MarketFit;
  error?: string;
};

export type StoreDetailResponse = {
  success: boolean;
  store: StoreResult | null;
  metaAds: MetaAdsSignal | null;
  error?: string;
};
