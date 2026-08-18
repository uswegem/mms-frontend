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
  // Intl's currency style renders TZS as the locale symbol "TSh", not the
  // literal "TZS" the design handoff's screens use throughout — spell it
  // out explicitly rather than let the symbol drift from the spec.
  const formatted = new Intl.NumberFormat('en-TZ', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${currency} ${formatted}`;
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

/**
 * Groups a Lipa Namba digit string left-to-right in blocks of 4.
 *   "7800000026"  →  "7800 0000 26"
 *   "22112025"    →  "2211 2025"
 */
export function formatLipaNamba(value: string): string {
  return value.replace(/(\d{4})(?=\d)/g, '$1 ');
}
