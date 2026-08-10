export type SampleProduct = {
  title: string;
  price: string;
  image: string;
};

export type StoreResult = {
  domain: string;
  platform: 'shopify';
  productsSample: number;
  sampleProducts: SampleProduct[];
  metaAdLink: string;
  tiktokAdLink: string;
};

export type SearchResponse = {
  success: boolean;
  niche: string;
  source: 'google_cse' | 'duckduckgo' | 'sample_fallback';
  candidatesScanned: number;
  results: StoreResult[];
  error?: string;
};
