import { cn } from '@/lib/utils';
import { type LucideIcon, TrendingDown, TrendingUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
  accent?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const accentStyles = {
  default: 'bg-[#eff6ff] text-[#1e40af]',
  success: 'bg-[#ecfdf5] text-[#047857]',
  warning: 'bg-[#fffbeb] text-[#b45309]',
  danger: 'bg-[#fef2f2] text-[#b91c1c]',
  info: 'bg-[#f0f9ff] text-[#0369a1]',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  accent = 'default',
}: StatCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              accentStyles[accent],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className={isPositive ? 'text-success' : 'text-destructive'}>
            {isPositive ? '+' : ''}
            {trend.value}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
