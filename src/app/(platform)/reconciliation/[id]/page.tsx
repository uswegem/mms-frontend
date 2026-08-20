'use client';

import { use } from 'react';
import { ReconciliationDetailView } from '@/components/reconciliation/reconciliation-detail-view';

export default function BackOfficeReconciliationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ReconciliationDetailView id={id} listHref="/reconciliation" />;
}
