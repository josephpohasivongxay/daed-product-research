# daed product research

A simple, mobile-first e-commerce research MVP: search a niche keyword, discover real Shopify
stores selling in that space, inspect a live sample of their catalog, sort/filter the results,
and jump straight to Meta Ad Library / TikTok Creative Center to spy on their ads. Stateless —
no database.

Built with Next.js (App Router) + TypeScript + Tailwind, deployable for free on Vercel.

## How it works

1. You enter a niche keyword (e.g. `organic dog shampoo`) in the dashboard search bar.
2. The `/api/search` route discovers candidate store domains for that niche via, in order:
   - **Google Custom Search API**, if `GOOGLE_CSE_KEY` / `GOOGLE_CSE_ID` are set.
   - **Brave Search API**, if `BRAVE_API_KEY` is set.
   - **DuckDuckGo HTML scrape** (free, no signup) as a best-effort fallback.
   - A small **sample domain list** if none of the above return anything, so the app is
     still demoable.
3. Each candidate domain is probed live at `https://<domain>/products.json?limit=250`. Only
   domains that respond with a valid Shopify product feed are kept — this is what actually
   confirms "real, active store," not the search step.
4. The dashboard renders each verified store as a catalog card (sample products, price range,
   catalog size, latest product activity, a rough revenue estimate) with direct links to Meta
   Ad Library and TikTok Creative Center for that domain.
5. Results can be sorted (name, newest activity, price, catalog size, est. revenue) and
   filtered (price range, minimum product count) entirely client-side, no extra requests.

## ⚠️ Making live search actually reliable

Search engines rate-limit or block scraping from shared serverless IPs (like Vercel's), so the
free DuckDuckGo fallback can go quiet under load and the app will silently fall back to sample
data — you'll see this in the small "Sample data (live search unavailable)" label under the
search bar. **For dependable live search, set at least one of these as environment variables**
(in Vercel: Project → Settings → Environment Variables):

| Variable | Provider | Free tier |
| :--- | :--- | :--- |
| `GOOGLE_CSE_KEY` + `GOOGLE_CSE_ID` | [Google Programmable Search](https://programmablesearchengine.google.com/) | 100 queries/day |
| `BRAVE_API_KEY` | [Brave Search API](https://brave.com/search/api/) | Free tier available |

Either is enough — the app tries Google first, then Brave, then DuckDuckGo, then sample data.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It works with zero configuration, though
see the reliability note above for why you'll likely want to add one API key.

Copy `.env.example` to `.env.local` to set the discovery provider keys locally.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com), **Add New Project** → import the repo.
3. Leave build settings as default (Next.js is auto-detected) and click **Deploy**.
4. Add `GOOGLE_CSE_KEY` / `GOOGLE_CSE_ID` and/or `BRAVE_API_KEY` as environment variables
   in the Vercel project settings, then redeploy — this is what makes search reliably live.

Your dashboard will be live at `https://your-project.vercel.app`.

## Project structure

```
app/
├── api/search/route.ts     # Discovery + Shopify catalog verification (serverless)
├── layout.tsx                # Root layout, mobile viewport meta
├── page.tsx                    # Dashboard: search, stats, sort/filter, results catalog
└── globals.css
components/
├── StatCard.tsx                # Dashboard stat tiles
├── StoreCard.tsx                 # Catalog card per verified store
└── SortFilterBar.tsx               # Sort dropdown + price/product-count filters
lib/
├── discovery.ts                    # Google CSE / Brave / DuckDuckGo domain discovery
├── shopify.ts                        # products.json fetch + stats normalization
├── revenue.ts                          # Pluggable revenue-estimate heuristic
├── sortFilter.ts                         # Client-side sort/filter logic
├── format.ts                               # Display formatting helpers
├── sampleDomains.ts                          # Fallback domains when live discovery fails
└── types.ts
```

## Notes & limitations

- Only Shopify stores are detected (via the public `products.json` endpoint), matching the
  original MVP scope. Other platforms (WooCommerce, custom storefronts) aren't supported yet.
- **Est. revenue is not real data.** Shopify's public feed doesn't expose sales figures, and
  free third-party revenue APIs don't really exist (Store Leads, Koala Inspector, SimilarWeb
  etc. are paid). The dashboard shows a clearly-labeled rough heuristic (avg. price × sampled
  catalog size × an assumed sell-through rate) so results can still be sorted by "rough size."
  To use real revenue data later, plug a provider into `lib/revenue.ts` — it's written as a
  single swappable function for exactly that.
- "Catalog size" reflects up to 250 items per store (Shopify's public feed page cap) — shown
  as "250+" when a store hits that cap, since the true total may be larger.
