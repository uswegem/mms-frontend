'use client';

import { cn } from '@/lib/utils';
import { ONBOARDING_WIZARD_STEPS } from '@/lib/onboarding-api';

interface OnboardingStepperProps {
  steps: { stepCode: string; completedAt: string | null }[];
  currentStep?: string | null;
  status: string;
}

export function OnboardingStepper({ steps, currentStep, status }: OnboardingStepperProps) {
  const completed = new Set(steps.filter((s) => s.completedAt).map((s) => s.stepCode));

  return (
    <ol className="flex flex-wrap gap-2">
      {ONBOARDING_WIZARD_STEPS.map((step, i) => {
        const done = completed.has(step.code);
        const active = currentStep === step.code || (!currentStep && i === 0);
        const failed = status.includes('FAILED') || status.includes('REJECTED');
        return (
          <li
            key={step.code}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium',
              done && 'border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success)]',
              !done && active && 'border-[var(--brand-yellow)] bg-[var(--accent-muted)]',
              !done && !active && 'border-border bg-muted/40 text-muted-foreground',
              failed && active && 'border-[var(--destructive-border)]',
            )}
          >
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
