import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ChartPanelProps {
  title: string;
  description: string;
  summary?: { label: string; value: string; change?: string };
  badge?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartPanel({
  title,
  description,
  summary,
  badge,
  children,
  className,
}: ChartPanelProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              {badge && <Badge variant="outline" className="text-[10px]">{badge}</Badge>}
            </div>
            <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
          </div>
          {summary && (
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{summary.label}</p>
              <p className="text-lg font-semibold tabular-nums">{summary.value}</p>
              {summary.change && (
                <p className="text-[10px] text-[var(--success)]">{summary.change}</p>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}
