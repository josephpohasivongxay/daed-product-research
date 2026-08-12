import type {
  CompetitiveFit,
  DemandFit,
  DemandSignal,
  MarketEvidence,
  MarketFit,
  MarketFitVerdict,
  PricingGap,
  StoreResult,
  TamSamSom,
  WillingnessToPayFit,
} from './types';
import { formatPriceRange } from './format';

/**
 * Ports the market-fit-orchestrator skill's 5-step framework (TAM, SAM/SOM,
 * demand signals, competitive landscape, willingness-to-pay -> ship/tweak/
 * kill verdict) into a deterministic calculation instead of the skill's
 * original live web-research + LLM synthesis approach.
 *
 * This is a real methodological difference, not just an implementation
 * detail: the skill does top-down (published industry reports) +
 * bottom-up (unit economics) research per idea via web search. This app
 * has no LLM/web-search step at request time (by design — see the
 * free-first notes elsewhere in this codebase), so TAM here is bottom-up
 * ONLY, built from the niche-relevant stores this search already verified
 * — which is also why it needs no extra network calls. Demand and
 * competitive-landscape reuse data this app already collects for other
 * panels; willingness-to-pay uses real observed pricing/sold-out/review
 * evidence from the same discovered stores, which is arguably stronger
 * evidence than the skill's own "search for competitor pricing pages"
 * step, since these are live-verified prices, not just published ones.
 */

// Discovery is a sample of the true market, not exhaustive — this states
// that assumption explicitly rather than pretending the found stores ARE
// the whole market. 4x is a deliberately conservative, documented guess.
const TAM_COVERAGE_MULTIPLIER = 4;

function computeTamSamSom(evidence: MarketEvidence): TamSamSom | null {
  if (!evidence.estimatedMarketRevenue) return null;

  const monthlyMid = (evidence.estimatedMarketRevenue.low + evidence.estimatedMarketRevenue.high) / 2;
  const tam = monthlyMid * 12 * TAM_COVERAGE_MULTIPLIER;

  const tamLabel: TamSamSom['tamLabel'] = tam < 50_000_000 ? 'Small' : tam < 1_000_000_000 ? 'Medium' : 'Large';

  // SAM: an already-online DTC/e-commerce niche has little geographic
  // constraint for a new entrant — small haircut for the slice not
  // reachable through typical paid/organic acquisition channels.
  const sam = tam * 0.9;

  // SOM: realistic 1-2 year capture for a new entrant with no existing
  // distribution, pulled down as more relevant competitors are found —
  // mirrors the skill's own "competitive intensity pulls SOM down" rule.
  const storeCount = evidence.relevantStoreCount;
  const somCaptureRate = storeCount <= 2 ? 0.08 : storeCount <= 7 ? 0.05 : storeCount <= 15 ? 0.03 : 0.015;
  const som = sam * somCaptureRate;

  const somCaptureLabel: TamSamSom['somCaptureLabel'] =
    somCaptureRate >= 0.15 ? 'High' : somCaptureRate >= 0.05 ? 'Moderate' : 'Low';

  return {
    tam,
    sam,
    som,
    tamLabel,
    somCaptureRate,
    somCaptureLabel,
    coverageMultiplier: TAM_COVERAGE_MULTIPLIER,
    assumptions: [
      `TAM assumes the ${evidence.relevantStoreCount} relevant store(s) found represent roughly 1/${TAM_COVERAGE_MULTIPLIER} of the true market — discovery is a live sample, not an exhaustive census.`,
      'SAM assumes ~90% of TAM is reachable through typical online acquisition for an already-digital DTC niche.',
      `SOM assumes a new entrant with no existing distribution/audience captures ~${(somCaptureRate * 100).toFixed(1)}% of SAM within 1-2 years — lower when more competitors were found, since that signals a more contested space.`,
    ],
  };
}

function computeDemandFit(demand: DemandSignal): DemandFit {
  const trendStatus = demand.trend?.status ?? null;
  const totalMentions = demand.community.reduce((sum, m) => sum + m.count, 0);

  if (trendStatus === 'rising' || totalMentions >= 20) {
    return {
      label: 'Rising',
      note: trendStatus
        ? `Google Trends shows rising interest${totalMentions > 0 ? `, backed by ${totalMentions} community mentions` : ''}.`
        : `${totalMentions} community mentions found — active organic pull, though Trends data wasn't available to confirm the search-interest trajectory.`,
    };
  }

  if (trendStatus === 'falling' && totalMentions < 5) {
    return {
      label: 'Cooling',
      note: 'Google Trends shows declining interest and there\'s little organic community discussion — the weakest demand combination this tool checks for.',
    };
  }

  if (!trendStatus && totalMentions === 0) {
    return {
      label: 'Cooling',
      note: 'No trend data and no community mentions found — either genuinely low current interest, or too niche/new for these particular free signals to pick up.',
    };
  }

  return {
    label: 'Steady',
    note: `${trendStatus ? `Trends shows ${trendStatus} interest` : 'Trend data unavailable'}${
      totalMentions > 0 ? ` with ${totalMentions} community mentions` : ', with limited community discussion found'
    } — a stable baseline rather than a clear signal either way.`,
  };
}

function computeCompetitiveFit(evidence: MarketEvidence, pricingGap: PricingGap | null): CompetitiveFit {
  const count = evidence.relevantStoreCount;
  const label: CompetitiveFit['label'] = count <= 2 ? 'Open' : count <= 15 ? 'Competitive' : 'Saturated';

  return { label, wedge: pricingGap?.note ?? null };
}

function computeWillingnessToPay(evidence: MarketEvidence, results: StoreResult[]): WillingnessToPayFit {
  const evidenceNotes: string[] = [];
  let score = 0;

  if (evidence.typicalPriceRange) {
    evidenceNotes.push(
      `Real, live-verified pricing found across relevant stores — not a hypothetical or a published rate card.`
    );
    score += 1;
  }

  const soldOutValues = results.map((r) => r.soldOutRatio).filter((v): v is number => v !== null);
  const avgSoldOut = soldOutValues.length ? soldOutValues.reduce((a, b) => a + b, 0) / soldOutValues.length : 0;
  if (avgSoldOut > 0.3) {
    evidenceNotes.push(
      `Average sold-out rate across relevant stores is ${Math.round(avgSoldOut * 100)}% — real inventory depletion at these prices, the strongest available evidence people actually pay, not just browse.`
    );
    score += 2;
  } else if (avgSoldOut > 0.1) {
    evidenceNotes.push(`Some sold-out inventory found (${Math.round(avgSoldOut * 100)}% average) — modest evidence of real purchases.`);
    score += 1;
  }

  if (evidence.wellReviewedStoreCount > 0) {
    evidenceNotes.push(
      `${evidence.wellReviewedStoreCount} relevant store(s) have 100+ reviews on relevant products — real purchase volume at the observed price point, the closest thing to "adjacent spend" evidence this tool can check for free.`
    );
    score += evidence.wellReviewedStoreCount >= 3 ? 2 : 1;
  }

  const label: WillingnessToPayFit['label'] = score >= 4 ? 'Strong' : score >= 2 ? 'Moderate' : 'Weak';

  return {
    label,
    priceRangeNote: evidence.typicalPriceRange
      ? formatPriceRange(evidence.typicalPriceRange.min, evidence.typicalPriceRange.max)
      : null,
    evidenceNotes: evidenceNotes.length
      ? evidenceNotes
      : ['No relevant stores with pricing, sold-out, or review data found — pricing is unproven, not confirmed weak.'],
  };
}

function computeVerdict(
  tamSamSom: TamSamSom | null,
  demand: DemandFit,
  competitive: CompetitiveFit,
  willingnessToPay: WillingnessToPayFit
): MarketFitVerdict {
  const reasoning: string[] = [];

  if (!tamSamSom) {
    reasoning.push('Not enough relevant stores with revenue data were found to size the market with any confidence — treat this verdict as low-confidence until a broader search or manual research fills that gap.');
  }

  const tamSmall = tamSamSom?.tamLabel === 'Small';
  const somLow = tamSamSom?.somCaptureLabel === 'Low';
  const demandCooling = demand.label === 'Cooling';
  const competitiveSaturatedNoWedge = competitive.label === 'Saturated' && !competitive.wedge;
  const wtpWeak = willingnessToPay.label === 'Weak';

  const killSignalCount = [tamSamSom !== null && tamSmall, demandCooling, wtpWeak].filter(Boolean).length;

  let verdict: MarketFitVerdict['verdict'];

  if (killSignalCount >= 2) {
    verdict = 'Kill';
    if (tamSmall) reasoning.push(`Estimated TAM is Small — even full capture wouldn't be a meaningful business.`);
    if (demandCooling) reasoning.push('Demand signals are Cooling — interest looks like it\'s declining, not building.');
    if (wtpWeak) reasoning.push('Willingness-to-pay evidence is Weak — no strong sign people spend real money here.');
    reasoning.push('Multiple weak signals are compounding rather than just one — that combination is what pushes this to Kill rather than Tweak.');
  } else if (
    tamSamSom !== null &&
    !tamSmall &&
    !somLow &&
    !demandCooling &&
    !competitiveSaturatedNoWedge &&
    !wtpWeak
  ) {
    verdict = 'Ship';
    reasoning.push(`TAM is ${tamSamSom.tamLabel}, SOM capture looks ${tamSamSom.somCaptureLabel}, demand is ${demand.label}, willingness-to-pay is ${willingnessToPay.label} — the signals line up rather than needing a stretch to justify.`);
    if (competitive.wedge) reasoning.push(`A specific gap was found: ${competitive.wedge}`);
  } else {
    verdict = 'Tweak';
    const mixed: string[] = [];
    if (tamSmall) mixed.push('TAM is Small');
    if (somLow) mixed.push('realistic capture (SOM) looks Low');
    if (demandCooling) mixed.push('demand looks Cooling');
    if (competitiveSaturatedNoWedge) mixed.push('the space looks Saturated with no clear wedge found');
    if (wtpWeak) mixed.push('willingness-to-pay evidence is Weak');
    reasoning.push(
      mixed.length
        ? `Mixed signals: ${mixed.join('; ')}. This doesn't rule the idea out, but suggests changing something specific — narrower positioning, different pricing, or a clearer differentiation angle — rather than shipping as-is or abandoning it.`
        : 'Signals are mixed enough that this needs a specific adjustment rather than a straightforward yes or no — check the individual scores above for which one to address.'
    );
  }

  return { verdict, reasoning };
}

export function computeMarketFit(
  evidence: MarketEvidence,
  demandSignal: DemandSignal,
  pricingGap: PricingGap | null,
  results: StoreResult[]
): MarketFit {
  const tamSamSom = computeTamSamSom(evidence);
  const demand = computeDemandFit(demandSignal);
  const competitive = computeCompetitiveFit(evidence, pricingGap);
  const willingnessToPay = computeWillingnessToPay(evidence, results);
  const verdict = computeVerdict(tamSamSom, demand, competitive, willingnessToPay);

  return { tamSamSom, demand, competitive, willingnessToPay, verdict };
}
