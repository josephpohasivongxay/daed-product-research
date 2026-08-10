export function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

export function formatPriceRange(min: number, max: number): string {
  if (min === max) return `$${min.toFixed(2)}`;
  return `$${min.toFixed(2)}–$${max.toFixed(2)}`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(iso)
  );
}

export function formatAge(months: number): string {
  if (months < 12) return `${months}mo old`;
  const years = months / 12;
  return `${years.toFixed(years < 10 ? 1 : 0)}y old`;
}

export function formatRank(rank: number): string {
  if (rank <= 1000) return `Top ${rank.toLocaleString()} sites`;
  if (rank <= 100_000) return `Top ${Math.round(rank / 1000)}K sites`;
  return `Top ${(rank / 1_000_000).toFixed(2)}M sites`;
}
