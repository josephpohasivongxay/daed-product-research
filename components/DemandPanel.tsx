import { TrendingUp, TrendingDown, Minus, MessageCircle } from 'lucide-react';
import type { DemandSignal, TrendPoint } from '@/lib/types';

const STATUS_META = {
  rising: { icon: TrendingUp, label: 'Rising interest', color: 'text-emerald-400' },
  falling: { icon: TrendingDown, label: 'Falling interest', color: 'text-amber-400' },
  steady: { icon: Minus, label: 'Steady interest', color: 'text-slate-400' },
} as const;

function Sparkline({ points }: { points: TrendPoint[] }) {
  const width = 140;
  const height = 32;
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1 || 1)) * width;
      const y = height - ((p.value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 text-brand-400">
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DemandPanel({ demand, niche }: { demand: DemandSignal; niche: string }) {
  const trend = demand.trend;
  const community = demand.community;

  if (!trend && community.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 mb-6">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">
        Demand signals for &ldquo;{niche}&rdquo;
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {trend &&
          (() => {
            const meta = STATUS_META[trend.status];
            const Icon = meta.icon;
            return (
              <div className="flex items-center gap-2">
                <Sparkline points={trend.points} />
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                  <span className="text-slate-600 font-normal">· Google Trends, 12mo</span>
                </span>
              </div>
            );
          })()}

        {community.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {community.map((m) => (
              <a
                key={m.source}
                href={m.topUrl ?? undefined}
                target={m.topUrl ? '_blank' : undefined}
                rel={m.topUrl ? 'noreferrer' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300 transition ${
                  m.topUrl ? 'hover:bg-slate-700 cursor-pointer' : 'cursor-default'
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5 text-slate-500" />
                {m.count}
                {m.isApproximate ? '+' : ''} {m.label} mention{m.count === 1 ? '' : 's'}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
