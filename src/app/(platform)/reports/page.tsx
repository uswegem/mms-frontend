'use client';

import { BarChart3 } from 'lucide-react';
import { ModulePreview } from '@/components/layout/module-preview';

export default function ReportsPage() {
  return (
    <ModulePreview
      title="Reports & Analytics"
      description="Regulatory reporting, merchant statements, executive analytics, and business intelligence dashboards."
      icon={BarChart3}
      features={[
        'Merchant daily/monthly statements',
        'Regulatory reports for BoT examination',
        'Transaction volume and revenue analytics',
        'Settlement and reconciliation reports',
        'School fee collection reports',
        'Export to PDF, CSV, and Excel',
        'Metabase BI integration',
        'Scheduled report delivery',
      ]}
      phase="Milestone 6"
    />
  );
}
