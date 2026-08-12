import type { AdMomentumLabel, MetaAdSummary } from './types';

/**
 * A display label derived from Meta Ad Library data — deliberately NOT a
 * numeric score folded into the Store Validation Score. Meta's public Ad
 * Library doesn't expose spend for ordinary commercial ads, so this can't
 * replicate an ad-spend-based "Ad Score"; it uses the two things this tool
 * actually has: how many active ads, and how long the longest-running one
 * has lasted. A long-running ad is the strongest available proxy for "this
 * creative is still converting" — Meta doesn't give a better one for free.
 */
export function computeAdMomentumLabel(summary: MetaAdSummary | null): AdMomentumLabel {
  if (!summary || summary.activeCount === 0) return null;
  if (summary.longestRunningDays !== null && summary.longestRunningDays >= 60) return 'Proven winner';
  if (summary.activeCount >= 3) return 'Scaling';
  return 'Testing';
}

/** Shared badge styling so the label reads consistently everywhere it appears (store cards, detail page, winning-products feed). */
export const AD_MOMENTUM_BADGE_STYLE: Record<Exclude<AdMomentumLabel, null>, string> = {
  'Proven winner': 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
  Scaling: 'border-brand-800 bg-brand-950/50 text-brand-300',
  Testing: 'border-amber-800 bg-amber-950/50 text-amber-300',
};
