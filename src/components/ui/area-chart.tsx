'use client';

import { cn } from '@/lib/utils';

interface DataPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: DataPoint[];
  height?: number;
  className?: string;
  color?: string;
  formatValue?: (v: number) => string;
}

export function AreaChart({
  data,
  height = 200,
  className,
  color = '#2563eb',
  formatValue = (v) => String(v),
}: AreaChartProps) {
  if (data.length === 0) return null;

  const padding = { top: 16, right: 4, bottom: 4, left: 4 };
  const width = 100;
  const chartH = height - padding.top - padding.bottom;

  const max = Math.max(...data.map((d) => d.value)) * 1.15;
  const min = Math.min(...data.map((d) => d.value)) * 0.9;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * (width - padding.left - padding.right);
    const y = padding.top + chartH - ((d.value - min) / (max - min)) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;
  const gradId = `areaGrad-${color.replace('#', '')}`;

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Area chart"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + chartH * (1 - pct)}
            y2={padding.top + chartH * (1 - pct)}
            stroke="#e2e8f0"
            strokeWidth="0.2"
            strokeDasharray={pct === 0 || pct === 1 ? '0' : '1 2'}
          />
        ))}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 2.5 : 1.5}
            fill={i === points.length - 1 ? color : '#fff'}
            stroke={color}
            strokeWidth="0.8"
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between px-0.5">
        {data.map((d) => (
          <span key={d.label} className="text-[10px] text-muted-foreground">
            {d.label}
          </span>
        ))}
      </div>
      <p className="sr-only">
        {data.map((d) => `${d.label}: ${formatValue(d.value)}`).join(', ')}
      </p>
    </div>
  );
}
