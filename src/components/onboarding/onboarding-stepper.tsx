'use client';

import { ONBOARDING_WIZARD_STEPS } from '@/lib/onboarding-api';
import { StepProgress, type StepProgressItem } from '@/components/onboarding/step-progress';

interface OnboardingStepperProps {
  steps: { stepCode: string; completedAt: string | null }[];
  currentStep?: string | null;
  status: string;
}

/**
 * Minimum pipeline rank that implies a wizard step is done.
 * Used when onboarding_steps.completedAt was not stamped (common after checker cascade).
 */
const STATUS_RANK: Record<string, number> = {
  DRAFT: 0,
  PENDING_KYC_DOCUMENTS: 0,
  SUBMITTED: 1,
  PENDING_KYC_APPROVAL: 1,
  UNDER_REVIEW: 2,
  KYC_REJECTED: 1,
  PENDING_RISK_REVIEW: 3,
  RISK_REJECTED: 2,
  PENDING_BANK_VALIDATION: 3,
  BANK_VALIDATION_FAILED: 3,
  BANK_VALIDATED: 4,
  PENDING_TPS_REGISTRATION: 4,
  TPS_REGISTRATION_FAILED: 4,
  TPS_REGISTERED: 5,
  PENDING_ALIAS_QR_SETUP: 5,
  ALIAS_QR_FAILED: 5,
  ALIAS_QR_REGISTERED: 6,
  PENDING_SETTLEMENT_SETUP: 6,
  SETTLEMENT_APPROVAL_PENDING: 6,
  SETTLEMENT_REJECTED: 6,
  SETTLEMENT_APPROVED: 7,
  READY_FOR_ACTIVATION: 7,
  APPROVED: 8,
  ACTIVE: 8,
  SUSPENDED: 8,
  REJECTED: 0,
  FAILED: 0,
};

/** Wizard step code → rank that must be reached for the step to count as done. */
const STEP_DONE_AT_RANK: Record<string, number> = {
  ENTITY_PROFILE: 1,
  KYC_DOCUMENTS: 1,
  SETTLEMENT_ACCOUNT: 1,
  RISK_REVIEW: 3,
  TPS_REGISTRATION: 5,
  ALIAS_QR_SETUP: 6,
  SETTLEMENT_CONFIG: 7,
  FINAL_REVIEW: 8,
};

function statusRank(status: string): number {
  return STATUS_RANK[status] ?? 0;
}

export function OnboardingStepper({ steps, currentStep, status }: OnboardingStepperProps) {
  const completedFromDb = new Set(steps.filter((s) => s.completedAt).map((s) => s.stepCode));
  const rank = statusRank(status);
  const failed = status.includes('FAILED') || status.includes('REJECTED');
  const fullyComplete = status === 'ACTIVE' || status === 'APPROVED' || status === 'SUSPENDED';

  const items: StepProgressItem[] = ONBOARDING_WIZARD_STEPS.map((step, i) => {
    const doneByDb = completedFromDb.has(step.code);
    const doneByStatus =
      fullyComplete || rank >= (STEP_DONE_AT_RANK[step.code] ?? 99);
    const done = doneByDb || doneByStatus;

    // When fully complete, never leave a trailing "active" circle — all green checks.
    const active =
      !fullyComplete &&
      !done &&
      (currentStep === step.code || (!currentStep && i === 0));

    return {
      key: step.code,
      label: step.label,
      state: done ? 'done' : active ? (failed ? 'failed' : 'active') : 'upcoming',
    };
  });

  return <StepProgress steps={items} />;
}
