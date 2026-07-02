import { type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface OpsItem {
  label: string;
  value: string;
  status: 'healthy' | 'warning' | 'critical' | 'neutral';
  icon: LucideIcon;
}

const statusStyles = {
  healthy: 'border-[var(--success-border)] bg-[var(--success-muted)]',
  warning: 'border-[var(--warning-border)] bg-[var(--warning-muted)]',
  critical: 'border-[var(--destructive-border)] bg-[var(--destructive-muted)]',
  neutral: 'border-border bg-muted/30',
};

const dotStyles = {
  healthy: 'bg-[var(--brand-yellow)]',
  warning: 'bg-[var(--brand-black)]',
  critical: 'bg-[var(--brand-black)]',
  neutral: 'bg-muted-foreground',
};

interface OperationsPanelProps {
  items: OpsItem[];
}

export function OperationsPanel({ items }: OperationsPanelProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Operations Health</CardTitle>
        <CardDescription className="text-xs">Settlement, reconciliation & network status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={cn(
                'flex items-center justify-between rounded-lg border px-3 py-2.5',
                statusStyles[item.status],
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tabular-nums">{item.value}</span>
                <span className={cn('h-2 w-2 rounded-full', dotStyles[item.status])} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
