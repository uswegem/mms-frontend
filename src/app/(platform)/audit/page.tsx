'use client';

import { FileText } from 'lucide-react';
import { ModulePreview } from '@/components/layout/module-preview';

export default function AuditPage() {
  return (
    <ModulePreview
      title="Audit Logs"
      description="Immutable audit trail for all platform actions — regulatory compliance and forensic investigation."
      icon={FileText}
      features={[
        'Immutable audit log persistence',
        'Actor, action, entity, and timestamp capture',
        'Before/after state change recording',
        'Correlation ID propagation',
        '7-year retention policy',
        'Search and filter by entity type',
        'Export for BoT examination',
        'SIEM integration (CloudWatch)',
      ]}
      phase="Milestone 2"
    />
  );
}
