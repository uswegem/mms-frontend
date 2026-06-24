import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
interface PortfolioItem {
  label: string;
  count: number;
  color: string;
  bg: string;
}

interface MerchantPortfolioProps {
  total: number;
  items: PortfolioItem[];
}

export function MerchantPortfolio({ total, items }: MerchantPortfolioProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Merchant Portfolio</CardTitle>
            <CardDescription className="text-xs">
              {total} merchants enrolled
            </CardDescription>
          </div>
          <Link
            href="/merchants"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Donut-style visual */}
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              {(() => {
                let offset = 0;
                return items.map((item) => {
                  const pct = total > 0 ? (item.count / total) * 100 : 0;
                  const dash = `${pct} ${100 - pct}`;
                  const el = (
                    <circle
                      key={item.label}
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="3.2"
                      strokeDasharray={dash}
                      strokeDashoffset={-offset}
                      strokeLinecap="round"
                    />
                  );
                  offset += pct;
                  return el;
                });
              })()}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold tabular-nums">{total}</span>
              <span className="text-[9px] text-muted-foreground">Total</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {items.map((item) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                    <span className="font-medium tabular-nums">{item.count} <span className="text-muted-foreground">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
