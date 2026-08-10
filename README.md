# daed product research

A mobile-first **e-commerce market intelligence** tool: search a niche keyword and get an
evidence-based read on whether a real, active market already exists for it — who's selling it,
how relevant they are, how much evidence there is of real demand, and a Market Validation Score
with a plain-language verdict. Stateless — no database.

Built with Next.js (App Router) + TypeScript + Tailwind, deployable for free on Vercel.

The core principle: **evidence over certainty**. Every estimate is labeled with its method and
confidence rather than presented as fact, and multiple independent signals agreeing carries more
weight than any single number.

## How it works

1. You enter a niche keyword (e.g. `portable ice bath`).
2. The `/api/search` route expands it into a few query variants (`portable ice bath`, `portable
   ice bath shop`, `portable ice bath buy online`, `"portable ice bath" site:myshopify.com`) and
   discovers candidate domains via, in order: **Google Custom Search** (if configured) →
   **Brave Search** (if configured) → a best-effort **DuckDuckGo scrape** → a small sample list
   if none of those return anything.
3. Each candidate is probed live at `https://<domain>/products.json`. Domains that respond with
   a valid Shopify feed are kept as full-data stores. Everything else isn't just discarded — its
   homepage gets a lightweight platform fingerprint check
   (Shopify/WooCommerce/BigCommerce/Magento/Wix/Squarespace/custom/unknown) and a homepage-text
   relevance read, and if it shows any real association with the niche, it's kept as a **thinner
   card** (domain, platform, relevance, domain age, popularity — no product/price/review data,
   since that extraction is Shopify-only). Only candidates with *zero* detected association to
   the niche are dropped — this is what makes the results a catalog of "every store associated
   with the keyword," not just whichever ones happen to run Shopify.
4. Within each store's catalog, products are **scored for relevance** to the searched niche
   (title/type/tags/description matching) — a store that sells 200 unrelated products and
   mentions the niche once won't outrank one whose catalog is built around it. Pricing, sample
   products, and the store's relevance % are all based on the relevant subset, not an arbitrary
   first-N slice.
5. Each store is enriched with domain age (RDAP/Wayback), popularity (Tranco rank), a review/
   rating pull from its top relevant product page, an estimated traffic tier, and a revenue
   *range* — then scored 0–100 (Demand / Commercial Proof / Popularity / Momentum /
   Monetization) as its **Store Validation Score**.
6. All of that rolls up into a niche-level **Market Validation Score** (0–100, same five
   categories but "Competition" instead of "Popularity") with an evidence summary and an
   auto-generated verdict — built from the actual numbers collected for that search, not
   hardcoded copy.
7. A **demand signals** panel shows whether search interest is rising or falling (Google Trends,
   12mo) and organic mention counts from Reddit and/or Hacker News (toggleable, not locked to
   one community).
8. Results default to sorting by Store Validation Score ("Recommended") instead of raw search
   order, and can be filtered by price, product count, or "established only" (6mo+ domain age).

## The Market Validation Score

0–100, weighted the same way at both the niche level and the per-store level (swapping
"Competition," a market-wide concept, for "Popularity" on individual store cards):

| Category | Points | Signals used |
| :--- | :--- | :--- |
| Demand | 25 | Relevant store count, Google Trends direction, community mentions |
| Commercial Proof | 25 | High-traffic-tier stores, review counts, sold-out rate |
| Competition / Popularity | 20 | Store count (additive, not punitive — see below) / Tranco rank + domain age |
| Momentum | 20 | Recent catalog activity, Trends direction |
| Monetization | 10 | Typical relevant-product price |

**Competition is not simply subtracted.** More established competitors is evidence a market
exists, not automatically a red flag — the score only pulls back slightly at extreme saturation
(15+ relevant stores) to reflect real crowding risk. Interpretation bands: 90–100 Extremely
Validated, 75–89 Highly Validated, 60–74 Validated, 40–59 Uncertain, 0–39 Weak.

## Free demand & commercial-proof signals

- **Sold-out rate** — share of sampled variants marked unavailable, computed from data already
  fetched (no extra request).
- **Google Trends (12mo)** — search interest trajectory for the niche, via Google's unofficial
  `explore` → `widgetdata` flow (the same one pytrends and similar libraries use). Free, no
  signup, but unofficial — can be rate-limited or break if Google changes the endpoint; degrades
  to omitted rather than erroring.
- **Community mentions** — Reddit's public search + Hacker News' official Algolia API, shown as
  toggleable chips so it isn't locked to one community. Adding a source is one function in
  `lib/community.ts` plus a registration line.
- **Reviews** — pulled from the schema.org `AggregateRating` JSON-LD that most Shopify review
  apps (Judge.me, Loox, Yotpo, ...) already inject into product pages for SEO. App-agnostic, no
  per-app integration needed. Reviews are a commercial-activity signal, not a sales count.
- **Domain age** — [RDAP](https://about.rdap.org/) (the IETF-standardized WHOIS replacement) via
  `rdap.org`'s free bootstrap redirector, falling back to the Wayback Machine's first capture
  date when RDAP doesn't cover a TLD or a registrar's privacy proxy hides the date.
- **Popularity (Tranco rank)** — [Tranco](https://tranco-list.eu/) is a free, research-grade
  top-1M domain ranking (the modern, non-defunct Alexa-rank replacement), used as a "most
  viewed" proxy. ⚠️ **Caveat:** this integration's exact response shape couldn't be verified
  against live docs from this build environment (network policy blocked reaching
  `tranco-list.eu`), so `lib/popularity.ts` parses leniently and fails to `null` safely — worth
  checking first if store cards never show a popularity rank on a live deploy.
- **Traffic tier & revenue range** — traffic is a coarse tier derived from Tranco rank
  (`lib/trafficEstimate.ts`), deliberately bucketed rather than a fabricated precise number.
  Revenue is `estimated visits × 1–3% conversion range × avg. relevant-product price`, always a
  low/base/high range with a confidence rating (never higher than "medium," since the traffic
  input is a rank tier, not measured traffic) — never a single fake-precise dollar figure.

## What's intentionally not automated (and why)

- **Ad activity detection.** Meta Ad Library is a client-rendered SPA with no public data
  endpoint; real detection needs either a Meta developer app + access token, or a headless
  browser per store, which doesn't fit a stateless serverless function. Store cards still link
  directly to Meta Ads Library / TikTok Creative Center for a manual check.
- **Social follower counts** (Instagram/TikTok/YouTube). Official APIs need business-account
  auth; public profile scraping is fragile and often JS-rendered. Not attempted.
- **Full multi-platform product extraction.** WooCommerce/BigCommerce/Magento stores *do* appear
  in the results catalog (see "How it works" above), but only with homepage-level relevance —
  full product/price/review extraction stays Shopify-only, since each platform has a different
  data shape and would be a separate scraper per platform.
- **True semantic keyword expansion** (e.g. "red light therapy" → "photobiomodulation"). That
  needs an LLM call, which costs money and breaks this app's free-first design. Query expansion
  here is mechanical (shop/buy/site: phrasings of the exact term), not semantic. A curated
  synonym dictionary was considered and rejected — it would only work for a handful of
  hand-picked niches and silently do nothing for the rest.
- **Positioning/branding/UX gap analysis.** The one opportunity signal implemented is a
  data-driven pricing-cluster gap (`lib/opportunity.ts`); the more subjective gaps (weak
  branding, poor UX) would need either an LLM read of each store or manual review.

## ⚠️ Making live search actually reliable

Search engines rate-limit or block scraping from shared serverless IPs (like Vercel's), so the
free DuckDuckGo fallback can go quiet under load and the app silently falls back to sample data
— you'll see this in the "Sample data (live search unavailable)" label under the search bar.
**For dependable live search, set at least one of these as environment variables** (in Vercel:
Project → Settings → Environment Variables):

| Variable | Provider | Free tier |
| :--- | :--- | :--- |
| `GOOGLE_CSE_KEY` + `GOOGLE_CSE_ID` | [Google Programmable Search](https://programmablesearchengine.google.com/) | 100 queries/day |
| `BRAVE_API_KEY` | [Brave Search API](https://brave.com/search/api/) | Free tier available |

Either is enough. Note query expansion means each user search can issue up to 5 provider calls
(fewer if the base query already fails), so a 100/day free tier is roughly 20 user searches/day.
Discovery pulls up to 30 candidate domains per search (up from an earlier, too-narrow 20) —
if a niche genuinely has very few relevant stores, a small result count is real signal, not a
bug; if results look suspiciously identical across different searches, check the label under
the search bar first — that almost always means live search itself isn't returning anything
(see above) and the app has silently fallen back to sample data.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `.env.example` to `.env.local` to set
discovery provider keys locally.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com), **Add New Project** → import the repo.
3. Leave build settings as default (Next.js is auto-detected) and click **Deploy**.
4. Add `GOOGLE_CSE_KEY` / `GOOGLE_CSE_ID` and/or `BRAVE_API_KEY` as environment variables, then
   redeploy.

Heavier searches (relevance scoring, domain age, popularity, and review lookups per candidate)
take longer than a plain search — `maxDuration` is set to 45s. If you hit Vercel's function
timeout on the Hobby plan, the fix is either upgrading to a plan with a longer limit or reducing
the candidate count in `app/api/search/route.ts`.

## Project structure

```
app/
├── api/search/route.ts        # Orchestrates discovery, per-store enrichment, and scoring
├── layout.tsx                   # Root layout, mobile viewport meta
├── page.tsx                       # Dashboard: search, market panel, sort/filter, results
└── globals.css
components/
├── MarketValidationPanel.tsx      # Score breakdown, evidence stats, verdict, pricing gap
├── DemandPanel.tsx                  # Trend sparkline + community mention chips
├── StoreCard.tsx                      # Catalog card per verified store (score, evidence)
└── SortFilterBar.tsx                    # Sort dropdown + price/product-count/age filters
lib/
├── queryExpansion.ts                      # Mechanical query variant generation
├── discovery.ts                             # Google CSE / Brave / DuckDuckGo, merged variants
├── relevance.ts                               # Lexical product/store relevance scoring
├── shopify.ts                                   # products.json fetch, relevance-ranked
├── platformDetect.ts                              # Lightweight non-Shopify classification
├── reviews.ts                                       # JSON-LD AggregateRating extraction
├── domainAge.ts                                       # RDAP + Wayback Machine domain age
├── popularity.ts                                        # Tranco rank (best-effort)
├── trafficEstimate.ts                                     # Rank-tier traffic estimate
├── revenue.ts                                               # Traffic x conversion x AOV range
├── trends.ts                                                  # Google Trends niche signal
├── community.ts                                                # Pluggable Reddit/HN mentions
├── marketScore.ts                                                # Store + market 0-100 scoring
├── marketEvidence.ts                                               # Niche-level evidence roll-up
├── verdict.ts                                                        # Evidence-driven verdict text
├── opportunity.ts                                                      # Pricing-gap analysis
├── sortFilter.ts                                                        # Client sort/filter
├── format.ts                                                              # Display formatting
├── sampleDomains.ts                                                        # Discovery fallback
└── types.ts
```

## Notes & limitations

- Product/pricing extraction is Shopify-only (via public `products.json`); other platforms are
  detected for market context but not scraped for products.
- **Every estimate is a range with a confidence rating, never a single "exact" number** — that's
  intentional (see "evidence over certainty" above), not a missing feature.
- "Catalog size" reflects up to 250 items per store (Shopify's public feed page cap) — shown as
  "250+" when a store hits that cap.
- Relevance, revenue, traffic, and the validation scores are all heuristics built from free
  public data. They're meant to focus manual research, not replace it.
