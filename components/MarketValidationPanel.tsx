import type { MarketValidation, ScoreLabel } from '@/lib/types';
import { formatRevenueRange, formatTrafficRange, formatPriceRange } from '@/lib/format';

const LABEL_COLOR: Record<ScoreLabel, string> = {
  'Extremely Validated': 'text-emerald-400',
  'Highly Validated': 'text-emerald-400',
  Validated: 'text-brand-300',
  Uncertain: 'text-amber-400',
  Weak: 'text-slate-400',
};

const CATEGORY_META: { key: keyof MarketValidation['score']['breakdown']; label: string; max: number }[] = [
  { key: 'demand', label: 'Demand', max: 25 },
  { key: 'commercialProof', label: 'Commercial Proof', max: 25 },
  { key: 'competition', label: 'Competition', max: 20 },
  { key: 'momentum', label: 'Momentum', max: 20 },
  { key: 'monetization', label: 'Monetization', max: 10 },
];

function EvidenceStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="text-slate-200 font-medium">{value}</p>
    </div>
  );
}

export default function MarketValidationPanel({ market, niche }: { market: MarketValidation; niche: string }) {
  const { score, evidence, verdict, pricingGap } = market;
  const labelColor = LABEL_COLOR[score.label];
  const platformEntries = Object.entries(evidence.platformBreakdown).filter(([, count]) => (count ?? 0) > 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 mb-6">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
        Market Validation for &ldquo;{niche}&rdquo;
      </p>
      <div className="flex items-baseline gap-3 mb-4">
        <span className={`text-3xl font-bold ${labelColor}`}>{score.total}</span>
        <span className="text-sm text-slate-500">/ 100</span>
        <span className={`text-sm font-semibold ${labelColor}`}>{score.label.toUpperCase()}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {CATEGORY_META.map(({ key, label, max }) => {
          const value = score.breakdown[key];
          const pct = Math.round((value / max) * 100);
          return (
            <div key={key}>
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>{label}</span>
                <span>
                  {value}/{max}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 text-xs">
        <EvidenceStat label="Relevant stores" value={String(evidence.relevantStoreCount)} />
        <EvidenceStat label="High-traffic stores" value={String(evidence.highTrafficStoreCount)} />
        <EvidenceStat label="Stores w/ 100+ reviews" value={String(evidence.wellReviewedStoreCount)} />
        {evidence.typicalPriceRange && (
          <EvidenceStat
            label="Typical relevant price"
            value={formatPriceRange(evidence.typicalPriceRange.min, evidence.typicalPriceRange.max)}
          />
        )}
        {evidence.estimatedCombinedTraffic && (
          <EvidenceStat
            label="Est. combined traffic"
            value={`${formatTrafficRange(evidence.estimatedCombinedTraffic.low, evidence.estimatedCombinedTraffic.high)}/mo`}
          />
        )}
        {evidence.estimatedMarketRevenue && (
          <EvidenceStat
            label={`Est. market revenue (${evidence.estimatedMarketRevenue.confidence} conf.)`}
            value={`${formatRevenueRange(evidence.estimatedMarketRevenue.low, evidence.estimatedMarketRevenue.high)}/mo`}
          />
        )}
      </div>

      <div className="border-t border-slate-800 pt-4">
        <p className="text-sm text-slate-300 mb-2">{verdict.summary}</p>
        <ul className="space-y-1 mb-3">
          {verdict.reasons.map((reason, i) => (
            <li key={i} className="text-xs text-slate-500 flex gap-1.5">
              <span className="text-brand-400">•</span>
              {reason}
            </li>
          ))}
        </ul>
        <p className="text-xs text-amber-400/90 mb-1">
          <span className="font-medium">Main risk:</span> {verdict.mainRisk}
        </p>
        <p className="text-xs text-emerald-400/90">
          <span className="font-medium">Opportunity:</span> {verdict.opportunity}
        </p>
      </div>

      {pricingGap && (
        <div className="border-t border-slate-800 mt-4 pt-4">
          <p className="text-xs text-slate-500">
            <span className="font-medium text-slate-400">Pricing gap: </span>
            {pricingGap.note}
          </p>
        </div>
      )}

      {platformEntries.length > 1 && (
        <div className="border-t border-slate-800 mt-4 pt-4">
          <p className="text-[11px] text-slate-600">
            Platforms seen among candidates:{' '}
            {platformEntries.map(([platform, count]) => `${platform} (${count})`).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
