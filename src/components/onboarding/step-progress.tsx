'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StepState = 'done' | 'active' | 'upcoming' | 'failed';

export interface StepProgressItem {
  key: string;
  label: string;
  icon?: ReactNode;
  state: StepState;
}

/** Horizontal numbered-circle stepper with a fill-as-you-go connecting track. */
export function StepProgress({ steps }: { steps: StepProgressItem[] }) {
  const lastActiveIdx = steps.reduce(
    (acc, s, i) => (s.state === 'done' || s.state === 'active' || s.state === 'failed' ? i : acc),
    0,
  );
  const progressPercent = steps.length > 1 ? (lastActiveIdx / (steps.length - 1)) * 100 : 0;

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="relative flex justify-between" style={{ minWidth: `${steps.length * 5}rem` }}>
        <div className="absolute left-0 right-0 top-[1.125rem] h-0.5 bg-border" />
        <div
          className="absolute left-0 top-[1.125rem] h-0.5 bg-[var(--brand-yellow)] transition-[width] duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
        {steps.map((step, i) => (
          <li
            key={step.key}
            className="relative z-10 flex flex-col items-center gap-1.5 px-1"
            style={{ width: `${100 / steps.length}%` }}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                step.state === 'done' && 'border-[var(--brand-yellow)] bg-[var(--brand-yellow)] text-[var(--brand-black)]',
                step.state === 'active' &&
                  'border-[var(--brand-yellow)] bg-card text-foreground shadow-[var(--shadow-md)]',
                step.state === 'upcoming' && 'border-border bg-muted text-muted-foreground',
                step.state === 'failed' &&
                  'border-[var(--destructive-border)] bg-[var(--destructive-muted)] text-[var(--destructive)]',
              )}
            >
              {step.state === 'done' ? <Check className="h-4 w-4" /> : (step.icon ?? i + 1)}
            </span>
            <span
              className={cn(
                'max-w-[5.5rem] text-center text-[11px] font-medium leading-tight',
                step.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
