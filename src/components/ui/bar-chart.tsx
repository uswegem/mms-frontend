'use client';

import { cn } from '@/lib/utils';

interface DataPoint {
  label: string;
  value: number;
}

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  className?: string;
  color?: string;
  highlightLast?: boolean;
}

export function BarChart({
  data,
  height = 200,
  className,
  color = '#1e3a5f',
  highlightLast = true,
}: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value)) * 1.12;

  return (
    <div className={cn('w-full', className)}>
      <div
        className="flex items-end justify-between gap-1.5 border-b border-border pb-0"
        style={{ height }}
        role="img"
        aria-label="Bar chart"
      >
        {data.map((d, i) => {
          const isHighlight = highlightLast && i === data.length - 2;
          const barH = Math.max((d.value / max) * 100, 3);
          return (
            <div key={d.label} className="group flex flex-1 flex-col items-center">
              <span className="mb-1 text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {d.value}
              </span>
              <div
                className="w-full max-w-[48px] rounded-t-md transition-all duration-300 group-hover:opacity-100"
                style={{
                  height: `${barH}%`,
                  backgroundColor: isHighlight ? '#2563eb' : color,
                  opacity: isHighlight ? 1 : 0.7,
                  minHeight: 6,
                }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-1">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[10px] text-muted-foreground">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
