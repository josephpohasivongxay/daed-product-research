export type SampleProduct = {
  title: string;
  price: string;
  image: string;
  /** Product page URL, or null if the store's handle was missing. */
  url: string | null;
  /** Product page handle — cross-referenced against a bestseller-collection check. */
  handle: string | null;
  /** Share of THIS product's sampled variants marked unavailable. null when availability wasn't tracked for it. */
  soldOutRatio: number | null;
  /** True when this specific product also appears in the store's own best-sellers collection. */
  isBestseller: boolean;
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
  /** Reviews dated within the last 90 days, when the source exposes individual review dates (JSON-LD `review[]` with `datePublished`). null = dates weren't available, not zero. */
  recentReviewCount: number | null;
  /** 'json-ld' = schema.org AggregateRating. 'widget-embed' = data attributes a review app (Judge.me/Loox/Stamped) server-renders into the page markup, read without calling any app API. */
  source: 'json-ld' | 'widget-embed';
};

export type SalesSignals = {
  /** True when a relevant product also appears in a /collections/best-sellers (or /bestsellers) listing. */
  isBestsellerListed: boolean;
  /** True when a "N sold" / "N+ sold recently" style badge text was found on an already-fetched product page. */
  hasSoldCountBadge: boolean;
  /** Share of sampled multi-variant relevant products with SOME but not all variants sold out — an organic depletion pattern, as opposed to a bulk delist (all) or nothing moving (none). null when there were no multi-variant products to check. */
  partialSelloutRatio: number | null;
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

/** Lightweight summary of MetaAdsSignal, carried on StoreResult so cards can show real ad numbers without shipping the full ad list to every result. */
export type MetaAdSummary = {
  activeCount: number;
  longestRunningDays: number | null;
};

export type Platform = 'shopify' | 'woocommerce' | 'bigcommerce' | 'magento' | 'wix' | 'squarespace' | 'custom' | 'unknown';

/**
 * v4 model: relevance is no longer a score category — it's a pass/fail gate
 * applied before a store is even ranked (see RELEVANCE_GATE_* in
 * lib/relevance.ts). Every category below answers "does this prove real,
 * replicable sales," not "is this on-topic."
 */
export type StoreScoreBreakdown = {
  /** Reviews (recency-weighted) + inventory depletion + sales-signal proxies — direct purchase evidence. Max 40. */
  commercialProof: number;
  /** Domain age weighted toward recent freshness, not just raw longevity. Max 15. */
  operationalHealth: number;
  /** Tranco traffic tier. Max 15. */
  trafficAuthority: number;
  /** Catalog/SKU depth — investment evidence, not recency-gated. Max 15. */
  catalogInvestment: number;
  /** Composite estimate of whether this looks like a small-operator-replicable win vs. a funded brand. Max 15. */
  replicability: number;
};

export type CommercialProofDetail = {
  reviewEvidence: number;
  inventoryDepletion: number;
  salesProxies: number;
  /** True when review data was a total miss and its 20-point share was redistributed into inventory/salesProxies instead of penalizing the store for missing data. */
  reviewDataRedistributed: boolean;
};

export type ScoreLabel = 'Extremely Validated' | 'Highly Validated' | 'Validated' | 'Uncertain' | 'Weak';

export type StoreScore = {
  total: number;
  breakdown: StoreScoreBreakdown;
  commercialProofDetail: CommercialProofDetail;
  label: ScoreLabel;
};

export type AngleFindings = {
  /** 2-3★ review text snippets, when the store's structured data exposes individual review bodies — pulled, not fabricated. */
  reviewGaps: string[];
  /** True only when at least one usable 2-3★ review snippet was actually extracted — false covers both "no review text exposed by this store's data source" and "exposed, but nothing in that range," since this tool can't tell those apart from structured data alone. */
  reviewGapsAvailable: boolean;
  pricePosition: string;
  replicabilityNote: string;
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
  /** Raw 2-3★ review text pulled from structured data, when available — always populated (possibly empty); lib/angleFindings.ts curates this into angleFindings.reviewGaps for the top 10. */
  reviewGapBodies: string[];
  /** Share of sampled variants marked unavailable — a free proxy for sell-through. */
  soldOutRatio: number | null;
  soldOutVariants: number;
  totalVariants: number;
  domainAge: DomainAge | null;
  popularity: Popularity | null;
  salesSignals: SalesSignals | null;
  /** true = active Meta/Facebook ads detected, false = checked and none found, null = not checked (only checked for stores that clear the relevance gate in a niche search). Display flag — not scored directly except as one input to the Replicability Flag. */
  paidTrafficIndicator: boolean | null;
  /** Real ad count + longest-running days, populated alongside paidTrafficIndicator. null = not checked. See lib/adMomentum.ts for the derived label shown on cards. */
  metaAdSummary: MetaAdSummary | null;
  /** Only populated for the top 10 stores by score in a given search — see lib/angleFindings.ts. */
  angleFindings: AngleFindings | null;
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

/** Ad Momentum is a display label derived from Meta Ad Library data (active count + longest-running days) — NOT a scored input to the Store Validation Score. 'Proven winner' = an ad still running 60+ days (still converting); 'Scaling' = 3+ concurrent active ads; 'Testing' = 1-2 active ads; null = no active ads detected, or not checked. */
export type AdMomentumLabel = 'Proven winner' | 'Scaling' | 'Testing' | null;

/**
 * A single product, flattened out of its store's sampleProducts and paired
 * with store-level attribution — the product-centric view real evidence
 * this tool has doesn't exist at true per-product granularity (no per-SKU
 * reviews or ad data), so "winning-ness" here is honestly a blend of the
 * PRODUCT's own signals (sold-out share, bestseller-collection listing)
 * and its STORE's signals (validation score, ad momentum) — never
 * presented as more precise than that.
 */
export type WinningProduct = {
  title: string;
  price: string;
  image: string;
  url: string | null;
  storeDomain: string;
  storeScore: number;
  soldOutRatio: number | null;
  isBestseller: boolean;
  adMomentum: AdMomentumLabel;
};

export type SearchResponse = {
  success: boolean;
  niche: string;
  source: 'tavily';
  candidatesScanned: number;
  /** False when this search was run with the relevance gate off (?gate=off) — results may include weak matches that would normally be filtered out. */
  relevanceGateApplied: boolean;
  results: StoreResult[];
  /** Individual products flattened across all results, ranked by a blended winning-signal heuristic — see lib/winningProducts.ts. */
  winningProducts: WinningProduct[];
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
