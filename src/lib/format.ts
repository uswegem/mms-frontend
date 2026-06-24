export function formatCurrency(
  amount: number,
  currency = 'TZS',
  compact = false,
): string {
  if (compact && amount >= 1_000_000) {
    return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (compact && amount >= 1_000) {
    return `${currency} ${(amount / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number, compact = false): string {
  if (compact && n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (compact && n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-TZ').format(n);
}

export function formatPercent(n: number, digits = 1): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
