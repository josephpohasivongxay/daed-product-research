# daed product research

A simple, mobile-first e-commerce research MVP: search a niche keyword, discover real Shopify
stores selling in that space, inspect a live sample of their catalog, and jump straight to Meta
Ad Library / TikTok Creative Center to spy on their ads. Stateless — no database.

Built with Next.js (App Router) + TypeScript + Tailwind, deployable for free on Vercel.

## How it works

1. You enter a niche keyword (e.g. `organic dog shampoo`) in the dashboard search bar.
2. The `/api/search` route discovers candidate store domains for that niche via, in order:
   - **Google Custom Search API**, if `GOOGLE_CSE_KEY` / `GOOGLE_CSE_ID` are set.
   - **DuckDuckGo HTML search** (free, no API key) as a fallback.
   - A small **sample domain list** if live discovery is unavailable (e.g. rate-limited),
     so the app is still demoable.
3. Each candidate domain is probed live at `https://<domain>/products.json?limit=6`. Only
   domains that respond with a valid Shopify product feed are kept — this is what actually
   confirms "real, active store," not the search step.
4. The dashboard renders each verified store as a catalog card (sample products, prices,
   images) with direct links to Meta Ad Library and TikTok Creative Center for that domain.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It works with zero configuration
(DuckDuckGo discovery needs no API key).

### Optional: better discovery with Google Custom Search

Copy `.env.example` to `.env.local` and fill in:

```
GOOGLE_CSE_KEY=your_api_key
GOOGLE_CSE_ID=your_search_engine_id
```

Get these from the [Google Programmable Search Engine console](https://programmablesearchengine.google.com/).
Without these, the app automatically falls back to the free DuckDuckGo scraper.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com), **Add New Project** → import the repo.
3. Leave build settings as default (Next.js is auto-detected) and click **Deploy**.
4. (Optional) Add `GOOGLE_CSE_KEY` / `GOOGLE_CSE_ID` as environment variables in the
   Vercel project settings for higher-quality discovery.

Your dashboard will be live at `https://your-project.vercel.app`.

## Project structure

```
app/
├── api/search/route.ts   # Discovery + Shopify catalog verification (serverless)
├── layout.tsx             # Root layout, mobile viewport meta
├── page.tsx                # Dashboard: search, stats, results catalog
└── globals.css
components/
├── StatCard.tsx            # Dashboard stat tiles
└── StoreCard.tsx            # Catalog card per verified store
lib/
├── discovery.ts             # Google CSE / DuckDuckGo domain discovery
├── shopify.ts                # products.json fetch + normalization
├── sampleDomains.ts           # Fallback domains when live discovery fails
└── types.ts
```

## Notes & limitations

- Only Shopify stores are detected (via the public `products.json` endpoint), matching the
  original MVP scope. Other platforms (WooCommerce, custom storefronts) aren't supported yet.
- The DuckDuckGo HTML scrape can occasionally be rate-limited by IP; when that happens the app
  falls back to the sample domain list rather than showing an error.
- "Products sampled" reflects up to 6 items per store, not the full catalog size — Shopify's
  public feed doesn't expose an exact total count without paginating every page.
