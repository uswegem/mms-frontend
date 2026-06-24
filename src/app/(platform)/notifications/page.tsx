'use client';

import { Bell } from 'lucide-react';
import { ModulePreview } from '@/components/layout/module-preview';

export default function NotificationsPage() {
  return (
    <ModulePreview
      title="Notifications"
      description="Multi-channel notification delivery — SMS, email, and in-app alerts for payments, settlements, and KYC."
      icon={Bell}
      features={[
        'Payment confirmation notifications',
        'Settlement advice delivery',
        'KYC decision notifications',
        'Reconciliation exception alerts',
        'School fee receipt SMS to guardians',
        'Template management (EN/SW)',
        'Notification preference configuration',
        'Delivery status tracking',
      ]}
      phase="Milestone 6"
    />
  );
}
