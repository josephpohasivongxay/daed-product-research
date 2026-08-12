import type { ReactNode } from 'react';
import { Rocket, Wrench, XCircle, TrendingUp, TrendingDown, Minus, Swords, DollarSign } from 'lucide-react';
import type { MarketFit, MarketFitVerdictLabel } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

const VERDICT_META: Record<MarketFitVerdictLabel, { icon: typeof Rocket; color: string; label: string }> = {
  Ship: { icon: Rocket, color: 'text-emerald-400 border-emerald-900 bg-emerald-950/40', label: 'SHIP' },
  Tweak: { icon: Wrench, color: 'text-amber-400 border-amber-900 bg-amber-950/40', label: 'TWEAK' },
  Kill: { icon: XCircle, color: 'text-red-400 border-red-900 bg-red-950/40', label: 'KILL' },
};

const DEMAND_ICON = { Rising: TrendingUp, Steady: Minus, Cooling: TrendingDown } as const;

function StatBlock({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint}>
      <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
      <p className="text-xl font-bold text-slate-100">{value}</p>
    </div>
  );
}

function MiniScoreCard({ title, label, detail }: { title: ReactNode; label: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[11px] text-slate-500 mb-1 inline-flex items-center gap-1">{title}</p>
      <p className="text-sm font-semibold text-slate-200 mb-1">{label}</p>
      <p className="text-[11px] text-slate-500 leading-snug">{detail}</p>
    </div>
  );
}

export default function MarketFitPanel({ marketFit, niche }: { marketFit: MarketFit; niche: string }) {
  const { tamSamSom, demand, competitive, willingnessToPay, verdict } = marketFit;
  const verdictMeta = VERDICT_META[verdict.verdict];
  const VerdictIcon = verdictMeta.icon;
  const DemandIcon = DEMAND_ICON[demand.label];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 mb-6">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">
        Market Fit Analysis for &ldquo;{niche}&rdquo;
      </p>

      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 mb-5 ${verdictMeta.color}`}>
        <VerdictIcon className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="text-base font-bold leading-none mb-1.5">{verdictMeta.label}</p>
          <ul className="space-y-1">
            {verdict.reasoning.map((r, i) => (
              <li key={i} className="text-xs opacity-90 leading-snug">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {tamSamSom ? (
        <>
          <div className="grid grid-cols-3 gap-4 mb-2">
            <StatBlock
              label={`TAM (${tamSamSom.tamLabel})`}
              value={formatCurrency(tamSamSom.tam)}
              hint="Annualized, bottom-up estimate — not a published industry figure"
            />
            <StatBlock label="SAM" value={formatCurrency(tamSamSom.sam)} />
            <StatBlock
              label={`SOM (${tamSamSom.somCaptureLabel} capture)`}
              value={formatCurrency(tamSamSom.som)}
              hint={`Assumes ~${(tamSamSom.somCaptureRate * 100).toFixed(1)}% capture by a new entrant`}
            />
          </div>
          <details className="mb-5">
            <summary className="text-[11px] text-slate-600 cursor-pointer hover:text-slate-500">
              Show TAM/SAM/SOM assumptions
            </summary>
            <ul className="mt-2 space-y-1">
              {tamSamSom.assumptions.map((a, i) => (
                <li key={i} className="text-[11px] text-slate-600 leading-snug">
                  • {a}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p className="text-xs text-slate-500 mb-5">
          Not enough relevant stores with revenue data were found to size TAM/SAM/SOM for this search.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniScoreCard
          title={
            <>
              <DemandIcon className="h-3 w-3" /> Demand
            </>
          }
          label={demand.label}
          detail={demand.note}
        />
        <MiniScoreCard
          title={
            <>
              <Swords className="h-3 w-3" /> Competitive Landscape
            </>
          }
          label={competitive.label}
          detail={competitive.wedge ?? 'No specific pricing gap/wedge identified from the data collected.'}
        />
        <MiniScoreCard
          title={
            <>
              <DollarSign className="h-3 w-3" /> Willingness to Pay
            </>
          }
          label={`${willingnessToPay.label}${willingnessToPay.priceRangeNote ? ` (${willingnessToPay.priceRangeNote})` : ''}`}
          detail={willingnessToPay.evidenceNotes[0]}
        />
      </div>
    </div>
  );
}
