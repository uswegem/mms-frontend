'use client';

import { use } from 'react';
import { DisputeDetailView } from '@/components/disputes/dispute-detail-view';

export default function BackOfficeDisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DisputeDetailView id={id} listHref="/disputes" />;
}
