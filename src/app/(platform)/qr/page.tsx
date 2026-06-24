'use client';

import { QrCode } from 'lucide-react';
import { ModulePreview } from '@/components/layout/module-preview';

export default function QrPage() {
  return (
    <ModulePreview
      title="QR Management"
      description="TANQR-compliant static and dynamic QR code issuance, rendering, and lifecycle management."
      icon={QrCode}
      features={[
        'Static QR (POI 11) generation',
        'Dynamic QR (POI 12) per invoice',
        'CRC16 computation and validation',
        'Annex 2 layout rendering (PNG/PDF)',
        'Bill number and reference fields (ID 62)',
        'Swahili language template support',
        'QR expiry and regeneration',
        'Batch print for merchant outlets',
      ]}
      phase="Milestone 4"
    />
  );
}
