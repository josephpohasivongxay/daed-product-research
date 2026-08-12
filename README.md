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
2. The `/api/search` route expands it into a few query variants (`portable ice bath`, `"portable
   ice bath" shop`, `portable ice bath buy online`, `portable ice bath store`, `"portable ice
   bath" site:myshopify.com`) and discovers candidate domains via **[Tavily](https://tavily.com)**
   search, merging and deduping results across variants. Tavily is the sole search provider —
   see "Search requires Tavily" below for why there's no scraping fallback.
3. Each candidate is probed live at `https://<domain>/products.json`. Domains that respond with
   a valid Shopify feed are kept as full-data stores. Everything else isn't just discarded — its
   homepage gets a lightweight platform fingerprint check
   (Shopify/WooCommerce/BigCommerce/Magento/Wix/Squarespace/custom/unknown) and a homepage-text
   relevance read, so stores on other platforms still show up (just with less data, since full
   product/price/review extraction is Shopify-only).
4. Within each store's catalog, products are **scored for relevance** to the searched niche
   (title/type/tags/description matching) — a store that sells 200 unrelated products and
   mentions the niche once won't outrank one whose catalog is built around it. By default, a
   store only enters the catalog at all once its relevance clears a **gate** (60% for a full
   Shopify catalog match, or a proportional 25% for the thinner homepage-only read non-Shopify
   stores get) — above that bar, relevance has no further effect on rank; it's a pass/fail filter,
   not part of the score. The **"Show every associated store" checkbox** next to the search bar
   turns this gate off for a search — it still requires *some* detected association (this isn't
   "show random domains"), just not the full 60%/25% bar, so you can see the long tail of weak
   matches the gate normally hides. See "The Store Validation Score" below for why the gate exists.
5. Each store is enriched with domain age (RDAP/Wayback), popularity (Tranco rank), review
   evidence pulled directly from its own product pages (JSON-LD, with a widget-embed fallback —
   never search-based), inventory-depletion and sales-signal proxies (bestseller-collection
   overlap, sold-count badges, partial-sellout patterns), an estimated traffic tier, and a
   revenue *range* — then scored 0–100 across five categories (Commercial Proof / Operational
   Health / Traffic & Authority / Catalog Investment / Replicability) as its **Store Validation
   Score**. See "The Store Validation Score" below for the full model and why it's these five.
6. All of that rolls up into a niche-level **Market Validation Score** (0–100, a separate set of
   five categories — Demand / Commercial Proof / Competition / Momentum / Monetization, see
   below) with an evidence summary and an auto-generated verdict — built from the actual numbers
   collected for that search, not hardcoded copy.
7. A **demand signals** panel shows whether search interest is rising or falling (Google Trends,
   12mo) and organic mention counts from Reddit and/or Hacker News (toggleable, not locked to
   one community). A separate **TikTok panel** gives one-click manual-check links (no live data
   — see below for why).
8. Results default to sorting by Store Validation Score ("Recommended") instead of raw search
   order, and default to showing only stores that clear the "Validated" bar (score 60+) — the
   **"Validated only" toggle** next to the store count switches between "the proven ones" and
   "everything that cleared the relevance gate," and other filters (price, product count,
   "established only" / 6mo+ domain age) live in the Filters panel.
9. The top 10 stores by score in every search get **angle-finding output** attached
   automatically: 2-3★ review-gap text (when the store's data exposes individual reviews), where
   its pricing sits against the rest of the relevant stores found, and a plain-language note on
   why it scored the way it did on Replicability. See "Angle-finding output" below.
10. Clicking a store opens its own **detail page** (`/store/<domain>`) instead of leaving the app
   — the full score breakdown, every evidence stat, its relevant products, its angle-finding
   notes, and (if configured) its active Facebook/Meta ads with how long each has been running. A
   separate "Visit site ↗" button on the catalog card still goes straight to the store itself.
11. A **Market Fit Analysis** panel runs first, above everything else — TAM/SAM/SOM, demand,
    competitive landscape, and willingness-to-pay, rolled into a Ship/Tweak/Kill verdict. See
    below for what this is and how it differs from the Market Validation Score.

## Market Fit Analysis (TAM/SAM/SOM + Ship/Tweak/Kill)

This ports this project's own `market-fit-orchestrator` skill — its 5-step framework (TAM,
SAM/SOM, demand signals, competitive landscape, willingness-to-pay → a ship/tweak/kill verdict)
— into the app itself (`lib/marketFit.ts`), shown as its own panel above the Market Validation
Score. **This is a genuinely different lens from the Market Validation Score**, not a duplicate:
the Validation Score asks "how strong is the evidence this specific search turned up," while
Market Fit asks "is this actually a market worth entering" in classic TAM/SAM/SOM terms.

**Important methodological difference from the original skill.** The skill does *live web
research* per idea — top-down published industry reports, bottom-up unit-economics search,
web-searched competitor pricing — via an LLM doing open-ended research at request time. This app
has no LLM/web-search step in its request path by design (see the free-first notes throughout
this README), so this port is **bottom-up only, computed entirely from data this search already
collected** — no extra network calls, no added latency, no added cost:

- **TAM** — the niche's estimated combined monthly revenue (already computed for the Market
  Validation panel), annualized, then scaled up by a stated coverage multiplier (4x) reflecting
  that live discovery finds a *sample* of the market, not an exhaustive census. This is
  explicitly not a published industry figure — there's no way to fetch one without an LLM call.
- **SAM** — TAM × ~90%, reflecting that an already-online DTC niche has little geographic
  reachability constraint for a new entrant (unlike the skill's original local-services examples,
  where SAM narrowing is about service radius).
- **SOM** — SAM × an assumed new-entrant capture rate (1.5–8%, scaled down as more relevant
  competitors are found — mirroring the skill's own "competitive intensity pulls SOM down" rule).
  There's no per-user capacity/distribution input in this app, so this always assumes zero
  existing audience — a business with real existing distribution could realistically capture more.
- **Demand** — reuses the same Google Trends + Reddit/HN community-mention data already shown in
  the Demand Signals panel, scored Cooling/Steady/Rising using the skill's own thresholds. (The
  skill's third demand sub-signal, marketplace/platform listing growth, isn't included — no free
  source for Etsy/Amazon category growth exists.)
- **Competitive Landscape** — reuses the relevant-store count and the pricing-gap opportunity
  note already computed for the Market Validation panel, scored Open/Competitive/Saturated.
- **Willingness to Pay** — built from real, live-verified pricing across relevant stores (not
  hypothetical or scraped from a rate card), average sold-out rate (real inventory depletion as
  purchase evidence), and review-count evidence (real purchase volume) — arguably *stronger*
  evidence than the skill's own "search for competitor pricing pages" step, since this is
  observed data from the actual stores this search found, not published listings.
- **Verdict** — Ship/Tweak/Kill, following the skill's own stated logic: Ship needs TAM
  Medium+, SOM capture Moderate+, demand not Cooling, no saturated-with-no-wedge competitive
  read, and WTP not Weak; Kill triggers when 2+ of {TAM Small, demand Cooling, WTP Weak} compound
  together (not just one); everything else is Tweak, with the reasoning naming what to change.

Every number here carries its assumptions (shown via "Show TAM/SAM/SOM assumptions" on the
panel) — treat this as a structured starting estimate to sanity-check, the same way the original
skill's own output is meant to be directional, not a certified market study.

## The Store Validation Score (v4)

0–100, per store, answering one question: **does this store prove REAL, REPLICABLE sales — the
kind a small operator could actually model and enter against — not just "does this look big or
busy"?**

### Step 1 — Relevance gate (pass/fail, not scored)

A store has to clear a minimum keyword-to-catalog match before it's ranked at all: **60%** for a
full Shopify catalog match, or a proportionally equivalent **25%** for non-Shopify stores (whose
homepage-only relevance read is capped at 40 to begin with, since it's much thinner evidence than
a whole product catalog — see `lib/relevance.ts`). Above its threshold, relevance has zero further
effect on rank. This replaced an earlier version where relevance was itself a scored category —
that conflated "is this on-topic" (a filter) with "is this validated" (the actual question).

**The gate is on by default but optional** — `?gate=off` on `/api/search` (wired to the "Show
every associated store" checkbox in the UI) skips the 60%/25% threshold while still requiring
`relevancePercent > 0` (some real detected association), so you can see the weaker matches the
gate normally excludes without opening the door to unrelated domains. The response's
`relevanceGateApplied` field reports which mode produced the results shown, and the UI surfaces
that as a note under the scanned-candidate count when it's off.

### Step 2 — Score (100 points)

| Category | Points | Signals used |
| :--- | :--- | :--- |
| Commercial Proof | 40 | Review evidence (20) + inventory depletion (10) + sales-signal proxies (10) |
| Operational Health | 15 | Domain age, weighted toward recent freshness over raw longevity |
| Traffic & Authority | 15 | Tranco rank tier |
| Catalog Investment | 15 | SKU/collection depth — not recency-gated |
| Replicability | 15 | Catalog size + paid-traffic indicator + domain-age-to-scale ratio |

Interpretation bands: 90–100 Extremely Validated, 75–89 Highly Validated, 60–74 Validated, 40–59
Uncertain, 0–39 Weak. The **"Validated only" filter defaults on** and shows stores at 60+.

**Commercial Proof (40)** is the core "did anyone actually buy" signal, broken into three parts:
- **Review evidence (20)** — sourced only from a direct-fetch waterfall per store (JSON-LD
  `AggregateRating`, then a widget-embed fallback — see below), never from search results, which
  don't see JS-rendered review-app content. Recent reviews (last 90 days) are weighted over raw
  total count, since recency is stronger "selling *now*" evidence than a large but possibly-stale
  total. **If review data is a total miss** (not "0 reviews found" — genuinely no data from either
  fetch step), its 20-point share is redistributed proportionally into the two signals below
  (10→20 each) so a store isn't structurally capped below others just because it lacks a review
  app; it has to earn those points from inventory/sales-proxy evidence instead.
- **Inventory depletion (10)** — sold-out variant share from `products.json`. Downweighted 50%
  when there's no corroborating review evidence, since sold-out alone is ambiguous (could reflect
  poor restocking, not demand).
- **Sales-signal proxies (10)** — bestseller-collection placement (does a relevant product also
  appear in the store's own `/collections/best-sellers`?), "N sold" style badge text found on an
  already-fetched product page, and a partial-variant-sellout pattern (some but not all variants
  of a product gone — organic depletion, vs. an all-or-nothing delist).

**Operational Health (15)** caps raw domain age at 7 of the 15 points, with the rest earned by
recent catalog activity and recent review flow — so a coasting multi-year-old store doesn't
automatically outscore an actively thriving newer one.

**Catalog Investment (15) is deliberately not recency-gated** — a lean, static, high-converting
catalog is investment evidence, not neglect.

**Replicability (15)** is the newest idea in this model: it doesn't ask "is this store
successful," it asks "could a small operator realistically copy this." A large funded brand and a
bootstrapped winner can look identical on every other category — this one is built specifically to
tell them apart, from three inputs: catalog size (leaner scores higher — easier to plan around
than a 250-SKU operation), the paid-traffic indicator (no detected ad spend reads as
organic/bootstrap-built; detected spend reads as funded growth; unknown gets neutral credit, never
a penalty), and a domain-age-to-scale ratio (reaching real scale FAST on a young domain usually
means capital-backed paid growth, not a copyable playbook; scale reached gradually reads as
organic and more realistically modelable).

**Explicitly out of scoring:** price/monetization tier. A $15 item and a $150 item are equally
valid proof a niche sells — price stays visible as metadata (the price stat on every card/detail
page) and feeds the angle-finding output's price-position note, never the 0–100 math.

`lib/marketScore.ts` (`computeStoreScore`) has the full formula and reasoning inline. This is the
second major redesign of this score — the first replaced an even earlier 5-category version
(Demand/Commercial Proof/Popularity/Momentum/Monetization) whose "Demand" category was just
relevance relabeled; this version goes further, replacing "is this store validated" with "is this
store's success something you could actually replicate."

### Review data collection: direct-fetch waterfall, not search

Reviews rendered by apps like Judge.me, Loox, Stamped, and Okendo are JS-widget content — not
present in crawlable page text a search index returns. This tool never tries to find reviews via
search; it fetches each candidate product page directly and reads structured data already on the
page:
1. **JSON-LD** (`schema.org/AggregateRating`) — most review apps inject this for SEO regardless of
   which app is installed. When the same JSON-LD exposes individual `review[]` entries with
   `datePublished`, those also drive the recency weighting above and the 2-3★ text used for
   angle-finding gap-mining.
2. **Widget-embed fallback** — if no JSON-LD is found, a regex scan for data attributes Judge.me,
   Loox, and Stamped commonly render server-side into their own preview badges (e.g.
   `data-average-rating`/`data-number-of-reviews`), independent of the JSON-LD block. This reads
   already-public, already-rendered markup — no app API tokens or undocumented endpoints involved.
3. **Null, not zero, on a total miss.** If both steps find nothing, review data is `null` —
   explicitly distinct from a real `0`. A `0` means "we found review data, and there wasn't any
   yet." `null` means "we don't know," and (per Commercial Proof above) doesn't penalize the store.

### Angle-finding output

The **top 10 stores by score** in every search get this attached automatically (not optional
extra credit) — visible on the store detail page under "Angle-finding notes":
- **Review gap-mining** — 2-3★ review text (not 5★), the primary way to spot a recurring
  complaint worth building a differentiated angle around. Pulled only from structured data this
  tool already fetched; when a store's data source doesn't expose individual review bodies, that's
  stated plainly rather than inventing a "common complaint."
- **Price position** — where this store's average relevant-product price sits against every other
  relevant store found this search (undercut / typical / premium).
- **Replicability context** — a plain-language note on why the Replicability score landed where it
  did, referencing catalog size, paid-ad detection, and domain age.

## The Market Validation Score

Niche-level, 0–100 — a different question from the Store Validation Score above ("is there
evidence of a market at all," not "does this one store prove it"), so it keeps its own five
categories:

| Category | Points | Signals used |
| :--- | :--- | :--- |
| Demand | 25 | Relevant store count, Google Trends direction, community mentions |
| Commercial Proof | 25 | High-traffic-tier stores, review counts, sold-out rate |
| Competition | 20 | Relevant store count (additive, not punitive — see below) |
| Momentum | 20 | Recent catalog activity, Trends direction |
| Monetization | 10 | Typical relevant-product price |

Unlike the Store Validation Score, price point *is* relevant here — the typical price the market
already supports is useful context for whether the niche can sustain a healthy margin, even
though it says nothing about any one store's proof of sales.

**Competition is not simply subtracted.** More established competitors is evidence a market
exists, not automatically a red flag — the score only pulls back slightly at extreme saturation
(15+ relevant stores) to reflect real crowding risk. Interpretation bands: 90–100 Extremely
Validated, 75–89 Highly Validated, 60–74 Validated, 40–59 Uncertain, 0–39 Weak.

**Commercial Proof is scored proportionally, not against a fixed store count.** An earlier
version required 5 stores at Tranco's "high"/"very high" traffic tier (top 100K/10K globally)
and 5 stores with 100+ reviews before contributing meaningful points — bars that are unrealistic
for a real niche search, which often surfaces well under 5 relevant stores total, and where even
a genuinely successful niche DTC brand rarely cracks the global top 100K. That made the score
read as near-zero on almost every search, which was a scoring bug, not evidence of a weak
market. It's now scored as a fraction of the relevant stores actually found: traffic credit is
weighted by tier (partial credit for "moderate"/"low" tiers, not just "high"/"very high"), review
credit scales with how many relevant stores show *any* reviews vs. 50+, and sold-out rate is
unchanged. `lib/marketScore.ts` has the full formula.

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
- **Reviews** — a direct-fetch waterfall (JSON-LD `AggregateRating`, then a widget-embed
  data-attribute fallback for Judge.me/Loox/Stamped) run against each store's own product pages —
  never search-based, since review-widget content is JS-rendered and invisible to a search index.
  See "Review data collection" above for the full waterfall and the null-vs-zero distinction.
- **Sales-signal proxies** — bestseller-collection overlap, "N sold" badge text, and partial-
  variant-sellout patterns, all read from data already fetched for the review waterfall and
  `products.json` (no extra requests beyond one best-sellers collection check per store).
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

## Facebook/Meta ad activity — free, but requires ID verification

Each store's detail page can show its active Facebook/Instagram ads (count, how long each has
been running, creative snippet, a link to view it) via Meta's **Ad Library API**. The same lookup
also feeds the **paid-traffic indicator** shown on every store card/detail page once a niche
search's results are gated — true (active ads found) / false (checked, none found) / not shown at
all (unchecked, e.g. no token configured). It's a display flag and a Replicability input, never
scored on its own. In a niche search it's only checked for stores that already cleared the
relevance gate, with a small concurrency limit (`PAID_TRAFFIC_CONCURRENCY` in
`app/api/search/route.ts`), so it doesn't fan out to every discovered candidate.

This is genuinely free with no paid tier — but **using it requires the account owner to personally
verify their identity with Meta first**: upload a government ID (passport, national ID, or
driver's license), confirm country of residence, and wait 1–3 business days for approval. This
is not the same kind of setup as pasting an API key — it's a real, personal verification step.

Once approved, create a Meta for Developers app, add the Ad Library API product, and generate an
access token. Set it as `META_ACCESS_TOKEN`. Without it, the app works completely normally —
the ads section just shows a manual "check Ad Library yourself" link instead.

**Known limitation:** the API is searched by a brand name *guessed* from the domain (e.g.
`coldplungeco.com` → `coldplungeco`), not the store's actual Facebook Page ID — if a brand's
Page name doesn't resemble its domain, the search may turn up nothing even though they're
advertising. Also, only creative/delivery-date fields are available for ordinary commercial ads;
spend and impression estimates are restricted to political/social-issue ads under Meta's
transparency rules, so "how long an ad has run" (not spend) is the strongest signal available
here — a long-running ad is a reasonable proxy for "this is working," which was the original ask.

## TikTok — no free API, so no fake data

There's no free official way to get TikTok search-volume or engagement (views/likes) by keyword.
TikTok's Research API requires institutional/academic approval; the alternatives are a paid
third-party wrapper or an unofficial scrape. This project already learned that lesson the hard
way with DuckDuckGo — its anti-bot interstitial got scraped as if it were real search results,
which silently returned identical fake data across different searches. Rather than risk repeating
that with TikTok, there's a **TikTok panel** on the results page (niche-level, not per-store, per
how this was asked for) with direct links to search TikTok and its Creative Center trends page —
an honest one-click manual check, not live numbers.

## Common selling angles — what competitors' copy has in common

The Market Validation panel includes a "Common selling angles" tag list — marketing/positioning
terms (single words and two-word phrases) that show up in product titles/descriptions across
**2 or more** relevant stores, e.g. "eco friendly," "sustainable materials," "cold plunge." This
uses text already fetched during discovery (`lib/angles.ts`), no extra requests. A term one store
uses once is that store's own copy, not surfaced — it has to repeat across multiple competitors
to count as a common angle. This is **lexical, not strategic**: it counts repeated words, it
doesn't understand marketing strategy or read positioning the way a person would. Treat it as a
prompt for what to look at manually (open a few of the stores using a given term and see how
they're actually using it), not a finished competitive-positioning analysis.

## What's intentionally not automated (and why)

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
- **Real positioning/branding/UX gap analysis.** The pricing-cluster gap (`lib/opportunity.ts`)
  and the common-angles tag list (`lib/angles.ts`) are both data-driven proxies; a genuine read of
  "this brand's positioning is weak" or "their UX loses customers" needs either an LLM read of
  each store or manual review — text-frequency counting isn't a substitute for that judgment.

## ⚠️ Search requires Tavily — there is no fallback

Discovery went through three providers over this project's history (Google CSE, Brave, a
DuckDuckGo scrape) and eventually a hardcoded sample-domain fallback for when all three failed.
That fallback was actively misleading — it silently served the same canned stores regardless of
what was searched, which is worse than an honest error, so it's gone. **The app now uses only
[Tavily](https://tavily.com)**, and if it can't be reached, search fails outright with a clear
"can't connect to Tavily" message instead of ever showing fake data.

This means `TAVILY_API_KEY` is **required**, not optional. Get one at
[tavily.com](https://tavily.com) (free tier available) and set it in Vercel: Project → Settings
→ Environment Variables → redeploy. Locally, copy `.env.example` to `.env.local` and fill it in.

**How to tell if it's working:** the small text under the search bar after a search says "Live
search · Tavily" on success. If a search instead shows a red error banner saying it can't
connect, `TAVILY_API_KEY` is missing, invalid, or Tavily itself is unreachable — check the key
in your deployment's environment variables first.

⚠️ **Caveat:** Tavily's exact response shape couldn't be fully verified end-to-end from this
build environment — `api.tavily.com` was blocked by this sandbox's network policy, the same
restriction that affected the Tranco integration earlier. `lib/discovery.ts`'s parsing was built
from Tavily's documented/GitHub-confirmed shape (`results[].url`) but hasn't been exercised
against a live response here. If search errors immediately even with a valid key, or returns
zero results for niches that clearly have stores, that parsing is the first place to check.

Query expansion means each search can issue up to 5 Tavily calls (fewer if the base query
already fails), so check your Tavily dashboard for how far your plan's quota goes. Discovery
pulls up to 30 candidate domains per search.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `.env.example` to `.env.local` and set
`TAVILY_API_KEY` — search will fail (with a clear error) without it.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com), **Add New Project** → import the repo.
3. Leave build settings as default (Next.js is auto-detected) and click **Deploy**.
4. Add `TAVILY_API_KEY` as an environment variable, then redeploy. Search will error clearly
   until this is set — there's no fallback mode. Optionally add `META_ACCESS_TOKEN` once you've
   completed Meta's identity verification (see above) to enable the ads section on store pages.

Heavier searches (relevance scoring, domain age, popularity, and review lookups per candidate)
take longer than a plain search — `maxDuration` is set to 45s. If you hit Vercel's function
timeout on the Hobby plan, the fix is either upgrading to a plan with a longer limit or reducing
the candidate count in `app/api/search/route.ts`.

## Project structure

```
app/
├── api/search/route.ts        # Orchestrates discovery, per-store enrichment, and scoring
├── api/store/route.ts           # Single-domain lookup (same enrichment + Meta ads)
├── store/[domain]/page.tsx        # Store detail page (Server Component, direct data fetch)
├── store/[domain]/loading.tsx       # Loading state for the detail page
├── layout.tsx                         # Root layout, mobile viewport meta
├── page.tsx                             # Dashboard: search, market panel, sort/filter, results
└── globals.css
components/
├── MarketFitPanel.tsx             # TAM/SAM/SOM + Ship/Tweak/Kill (renders first)
├── MarketValidationPanel.tsx        # Score breakdown, evidence stats, verdict, pricing gap
├── DemandPanel.tsx                    # Trend sparkline + community mention chips
├── TikTokPanel.tsx                      # Manual-check links (no live data — see above)
├── StoreCard.tsx                          # Catalog card per verified store (score, evidence)
├── StoreDetailView.tsx                      # Full store breakdown + Meta ads section
└── SortFilterBar.tsx                          # Sort dropdown + price/product-count/age filters
lib/
├── queryExpansion.ts                             # Mechanical query variant generation
├── discovery.ts                                    # Tavily search, merged query variants
├── relevance.ts                                      # Lexical product/store relevance scoring + gate thresholds
├── shopify.ts                                          # products.json fetch, relevance-ranked + bestseller/sellout signals
├── platformDetect.ts                                     # Lightweight non-Shopify classification
├── reviews.ts                                              # JSON-LD + widget-embed review waterfall, recency, gap text
├── domainAge.ts                                              # RDAP + Wayback Machine domain age
├── popularity.ts                                               # Tranco rank (best-effort)
├── trafficEstimate.ts                                            # Rank-tier traffic estimate
├── revenue.ts                                                      # Traffic x conversion x AOV range
├── trends.ts                                                         # Google Trends niche signal
├── community.ts                                                        # Pluggable Reddit/HN mentions
├── metaAds.ts                                                            # Meta Ad Library + paid-traffic indicator
├── buildStoreResult.ts                                                     # Shared per-domain enrichment
├── concurrency.ts                                                            # Bounded-concurrency fetch helper
├── angleFindings.ts                                                            # Top-10 review-gap/price-position/replicability notes
├── marketScore.ts                                                                # Store (v4, 5-category) + market 0-100 scoring
├── marketEvidence.ts                                                               # Niche-level evidence roll-up
├── marketFit.ts                                                                      # TAM/SAM/SOM + ship/tweak/kill
├── verdict.ts                                                                          # Evidence-driven verdict text
├── opportunity.ts                                                                        # Pricing-gap analysis
├── angles.ts                                                                               # Common selling-angle extraction
├── sortFilter.ts                                                                             # Client sort/filter
├── format.ts                                                                                   # Display formatting
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
