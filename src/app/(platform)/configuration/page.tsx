'use client';

import { Settings } from 'lucide-react';
import { ModulePreview } from '@/components/layout/module-preview';

export default function ConfigurationPage() {
  return (
    <ModulePreview
      title="Configuration Management"
      description="System parameters, settlement cut-offs, fee rules, feature flags, and acquirer configuration."
      icon={Settings}
      features={[
        'Acquirer profile configuration',
        'Settlement calendar and cut-off times',
        'MDR and TIPS fee rule management',
        'Transaction limit defaults',
        'Feature flag toggles',
        'i18n language configuration (EN/SW)',
        'TIPS participant credentials',
        'CBS integration endpoints',
      ]}
      phase="Milestone 3"
    />
  );
}
