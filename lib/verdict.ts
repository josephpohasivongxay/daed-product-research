import type { MarketEvidence, MarketScore, MarketVerdict } from './types';
import { formatCurrency } from './format';

/**
 * Builds verdict text from the actual collected numbers for this search,
 * not hardcoded copy — swap in different evidence and the sentences change.
 * Still template-based rather than free-form generation (no LLM wired into
 * this app), so phrasing is fixed even though the content isn't.
 */
export function generateVerdict(score: MarketScore, evidence: MarketEvidence, niche: string): MarketVerdict {
  const reasons: string[] = [];

  if (evidence.relevantStoreCount >= 8) {
    reasons.push(`${evidence.relevantStoreCount} stores were found actively selling products relevant to "${niche}"`);
  } else if (evidence.relevantStoreCount >= 3) {
    reasons.push(`${evidence.relevantStoreCount} relevant stores were found — a modest but real market`);
  } else if (evidence.relevantStoreCount > 0) {
    reasons.push(`Only ${evidence.relevantStoreCount} relevant store(s) were found — limited public evidence`);
  } else {
    reasons.push('No clearly relevant stores were found in this search');
  }

  if (evidence.highTrafficStoreCount > 0) {
    reasons.push(`${evidence.highTrafficStoreCount} store(s) show a high estimated-traffic tier`);
  }
  if (evidence.wellReviewedStoreCount > 0) {
    reasons.push(`${evidence.wellReviewedStoreCount} store(s) have 100+ reviews on relevant products`);
  }
  if (evidence.typicalPriceRange) {
    reasons.push(
      `Typical relevant-product price is ${formatCurrency(evidence.typicalPriceRange.min)}–${formatCurrency(evidence.typicalPriceRange.max)}, supporting meaningful order values`
    );
  }
  if (evidence.estimatedMarketRevenue) {
    reasons.push(
      `Estimated combined market revenue is ${formatCurrency(evidence.estimatedMarketRevenue.low)}–${formatCurrency(evidence.estimatedMarketRevenue.high)}/month (${evidence.estimatedMarketRevenue.confidence} confidence)`
    );
  }

  let mainRisk: string;
  if (evidence.relevantStoreCount > 15) {
    mainRisk = 'Competition is high — differentiation will matter more than being first.';
  } else if (evidence.relevantStoreCount <= 2) {
    mainRisk =
      'Limited public evidence — this could be an underexplored niche or genuinely low demand; validate further before committing.';
  } else if (evidence.wellReviewedStoreCount === 0) {
    mainRisk = 'No strong review evidence found yet — commercial proof is thinner than the store count suggests.';
  } else {
    mainRisk = 'Moderate competition — a clear differentiation angle is still recommended.';
  }

  let opportunity: string;
  if (score.total >= 60) {
    opportunity =
      'Public evidence supports a real, active market. A differentiated product or brand angle looks more promising than competing head-on with identical positioning.';
  } else if (score.total >= 40) {
    opportunity = 'Evidence is mixed — worth deeper manual research (talk to potential customers, check adjacent keywords) before committing.';
  } else {
    opportunity =
      'Public evidence is weak. This could mean a genuinely underserved niche, or limited demand — treat with caution and validate further.';
  }

  const summaryByLabel: Record<MarketScore['label'], string> = {
    'Extremely Validated': `The available public evidence strongly suggests an established, active market for "${niche}".`,
    'Highly Validated': `The available public evidence suggests a solid, active market for "${niche}".`,
    Validated: `There's reasonable public evidence of an active market for "${niche}", though not overwhelming.`,
    Uncertain: `Public evidence for "${niche}" is mixed — some signals present, others weak or missing.`,
    Weak: `Public evidence for "${niche}" is weak based on what's freely discoverable — this doesn't rule out demand, but it isn't confirmed by this search.`,
  };

  return { summary: summaryByLabel[score.label], reasons, mainRisk, opportunity };
}
