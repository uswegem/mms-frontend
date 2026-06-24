'use client';

import { Scale } from 'lucide-react';
import { ModulePreview } from '@/components/layout/module-preview';

export default function ReconciliationPage() {
  return (
    <ModulePreview
      title="Reconciliation"
      description="Three-way reconciliation matching MMS ledger, TIPS settlement reports, and CBS EOD statements."
      icon={Scale}
      features={[
        'Daily T+1 reconciliation runs',
        'Three-way match (MMS / TIPS / CBS)',
        'Exception queue with assignment',
        'Amount and timing mismatch resolution',
        'Manual payment ingest for TIPS-only items',
        'Reconciliation state machine',
        'Operations analyst dashboard',
        'Compliance escalation workflow',
      ]}
      phase="Milestone 5"
    />
  );
}
