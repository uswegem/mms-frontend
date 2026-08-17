import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeroMetric {
  label: string;
  value: string;
  change?: { value: number; label: string };
  sublabel?: string;
  /** If set, renders a small "preview data" tag in the tile header. */
  badge?: string;
}

interface HeroMetricsProps {
  metrics: HeroMetric[];
}

export function HeroMetrics({ metrics }: HeroMetricsProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm)]">
      <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {metrics.map((m, i) => {
          const positive = m.change && m.change.value >= 0;
          return (
            <div key={m.label} className={cn('px-6 py-5', i === 0 && 'bg-[var(--accent-muted)]')}>
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </p>
                {m.badge && (
                  <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                    {m.badge}
                  </span>
                )}
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                {m.value}
              </p>
              {m.sublabel && (
                <p className="mt-1 text-xs text-muted-foreground">{m.sublabel}</p>
              )}
              {m.change && (
                <div className="mt-3 flex items-center gap-1.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                      positive
                        ? 'bg-[var(--success-muted)] text-[var(--success)]'
                        : 'bg-[var(--info-muted)] text-[var(--brand-black)]',
                    )}
                  >
                    {positive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {positive ? '+' : ''}
                    {m.change.value}%
                  </span>
                  <span className="text-[11px] text-muted-foreground">{m.change.label}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
