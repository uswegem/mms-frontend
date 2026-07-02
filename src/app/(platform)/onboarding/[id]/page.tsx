'use client';

import { use } from 'react';
import { OnboardingDetailView } from '@/components/onboarding/onboarding-detail-view';

export default function OnboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <OnboardingDetailView id={id} />;
}
