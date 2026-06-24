'use client';

import { Wallet } from 'lucide-react';
import { ModulePreview } from '@/components/layout/module-preview';

export default function SettlementsPage() {
  return (
    <ModulePreview
      title="Settlements"
      description="Settlement batch aggregation, MDR fee deduction, maker-checker approval, and CBS posting."
      icon={Wallet}
      features={[
        'Settlement calendar and cut-off management',
        'Batch aggregation by merchant',
        'MDR and TIPS fee calculation',
        'Maker-checker batch approval',
        'CBS account posting worker',
        'Merchant settlement advice notifications',
        'GL entry generation',
        'Merchant statement generation (PDF/CSV)',
      ]}
      phase="Milestone 5"
    />
  );
}
