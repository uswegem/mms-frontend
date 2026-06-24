'use client';

import { Receipt } from 'lucide-react';
import { ModulePreview } from '@/components/layout/module-preview';

export default function TransactionsPage() {
  return (
    <ModulePreview
      title="Transactions"
      description="Payment ingestion from TIPS webhooks, transaction matching, status lifecycle, and idempotency."
      icon={Receipt}
      features={[
        'TIPS payment notification webhooks',
        'Idempotent processing by tipsEndToEndId',
        'Payment status lifecycle management',
        'Multi-channel merchant notifications',
        'Request to Pay support',
        'Reversal and dispute handling',
        'Partial payment support',
        'Transaction search and export',
      ]}
      phase="Milestone 4"
    />
  );
}
