import type { LucideIcon } from 'lucide-react';

export default function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 sm:p-4">
      <div className="flex items-center gap-2 text-slate-500 mb-1.5">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}
