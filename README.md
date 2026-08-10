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
   catalog size, latest product activity, sold-out rate, domain age, popularity rank, a rough
   revenue estimate) with direct links to Meta Ad Library and TikTok Creative Center.
5. Results default to a **Recommended** ranking — a blend of domain age, popularity, sold-out
   rate, and recent activity — instead of raw search order, so established/trending/selling
   stores surface first rather than whatever order the search step happened to return. Results
   can also be sorted by name, date, price, catalog size, sold-out rate, or est. revenue, and
   filtered by price range, minimum product count, or "established only" (6mo+ domain age) —
   entirely client-side, no extra requests.
6. A **demand signals** panel above the results shows whether search interest in the niche is
   rising or falling (Google Trends, 12mo) and how much people are organically talking about it
   on Reddit and/or Hacker News — toggleable per search, so it isn't locked to one community.

## Demand validation signals

Beyond "is this a real store," the dashboard surfaces free signals for "is this actually in
demand":

- **Sold-out rate** — the share of sampled product variants marked unavailable, computed from
  data already fetched (no extra request). A store selling through inventory fast is a demand
  signal; a store that's permanently sold out everywhere may just be a supply problem, so treat
  it as a prompt to look closer, not a verdict on its own.
- **Google Trends (12mo)** — search interest over time for the niche keyword, classified as
  rising / steady / falling. This uses Google's unofficial, undocumented Trends API (the same
  reverse-engineered `explore` → `widgetdata` flow long-standing libraries like pytrends use).
  It's free and needs no signup, but — like the DuckDuckGo fallback — it can be rate-limited or
  break if Google changes the endpoint; when that happens the panel just omits the trend rather
  than erroring.
- **Community mentions** — organic mention counts from Reddit's public search and Hacker
  News' official Algolia search API, shown as toggleable chips ("Check demand in: Reddit /
  Hacker News") so it isn't locked to a single community. Adding another source (a different
  forum, subreddit-specific search, etc.) is one function in `lib/community.ts` plus a
  registration line — nothing else needs to change.

None of these are real revenue or sales data — they're the best free signals available without
paying for a market-research API, and are labeled in the UI accordingly.

## Ranking: domain age, popularity, and "recommended"

To avoid surfacing stores in arbitrary search order, each verified store also gets:

- **Domain age** — via [RDAP](https://about.rdap.org/) (the IETF-standardized, structured-JSON
  replacement for WHOIS), using `rdap.org`'s free bootstrap redirector to reach the domain's
  authoritative registry. Falls back to the Wayback Machine's first successful capture date
  when RDAP doesn't cover a TLD or a registrar's privacy proxy hides the registration date —
  both free, official, no signup. This directly answers "has this store been around a while,"
  and backs the "Established only" filter.
- **Popularity (Tranco rank)** — [Tranco](https://tranco-list.eu/) is a free, research-grade
  top-1M domain ranking (the modern, non-defunct replacement for Alexa rank), used as a "most
  viewed" proxy without a paid traffic API. ⚠️ **Caveat:** this integration's exact response
  shape couldn't be verified against live docs from this build environment (network policy
  blocked reaching `tranco-list.eu`), so parsing is deliberately lenient and, like the other
  best-effort signals, fails to `null` safely rather than breaking search — but it may need a
  follow-up fix once tested against the real API on a live deploy. Worth checking `lib/popularity.ts`
  first if store cards never show a popularity rank.
- **Recommended sort** (`lib/sortFilter.ts`) combines domain age + Tranco rank + sold-out rate
  + recent catalog activity + est. revenue into one score, and is the default ordering. The
  revenue heuristic itself is also weighted by domain age and Tranco rank (older + more popular
  → higher assumed sell-through), so "projected sales" leans toward stores that look established
  and trending rather than being a flat guess for every store alike.

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
├── SortFilterBar.tsx               # Sort dropdown + price/product-count filters
└── DemandPanel.tsx                   # Trend sparkline + community mention chips
lib/
├── discovery.ts                    # Google CSE / Brave / DuckDuckGo domain discovery
├── shopify.ts                        # products.json fetch + stats normalization
├── domainAge.ts                        # RDAP + Wayback Machine domain-age signal
├── popularity.ts                         # Tranco popularity rank (best-effort)
├── trends.ts                               # Google Trends niche interest-over-time signal
├── community.ts                              # Pluggable Reddit / Hacker News mention counts
├── revenue.ts                                   # Pluggable, age/popularity-weighted revenue heuristic
├── sortFilter.ts                                  # Recommended ranking + client-side sort/filter
├── format.ts                                        # Display formatting helpers
├── sampleDomains.ts                                   # Fallback domains when live discovery fails
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
