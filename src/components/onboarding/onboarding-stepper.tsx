'use client';

import { ONBOARDING_WIZARD_STEPS } from '@/lib/onboarding-api';
import { StepProgress, type StepProgressItem } from '@/components/onboarding/step-progress';

interface OnboardingStepperProps {
  steps: { stepCode: string; completedAt: string | null }[];
  currentStep?: string | null;
  status: string;
}

export function OnboardingStepper({ steps, currentStep, status }: OnboardingStepperProps) {
  const completed = new Set(steps.filter((s) => s.completedAt).map((s) => s.stepCode));
  const failed = status.includes('FAILED') || status.includes('REJECTED');

  const items: StepProgressItem[] = ONBOARDING_WIZARD_STEPS.map((step, i) => {
    const done = completed.has(step.code);
    const active = currentStep === step.code || (!currentStep && i === 0);
    return {
      key: step.code,
      label: step.label,
      state: done ? 'done' : active ? (failed ? 'failed' : 'active') : 'upcoming',
    };
  });

  return <StepProgress steps={items} />;
}
