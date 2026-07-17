'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TanqrDisplayLayout } from './tanqr-display-layout';
import { QrStatusBadge } from './qr-status-badge';
import { formatDateTime } from '@/lib/format';
import { canRevealInternalId } from '@/lib/qr-permissions';
import type { JwtClaims } from '@/lib/auth-api';
import type { MerchantQrCode } from '@/types/merchant-qr';

interface QrPreviewModalProps {
  open: boolean;
  qr: MerchantQrCode | null;
  user: JwtClaims | null;
  onClose: () => void;
  onCopyPayload: (payload: string) => void;
}

export function QrPreviewModal({
  open,
  qr,
  user,
  onClose,
  onCopyPayload,
}: QrPreviewModalProps) {
  const [showInternal, setShowInternal] = useState(false);

  if (!open || !qr) return null;

  const revealInternal = canRevealInternalId(user) && showInternal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-card shadow-lg">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold">QR Code Preview</h3>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="payload">Payload</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="mt-4 space-y-4">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <TanqrDisplayLayout
                  alias={qr.alias}
                  merchantName={qr.merchant_name}
                  tlvPayload={qr.tlv_payload}
                  assets={qr.assets}
                  qrSize={220}
                />
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <QrStatusBadge status={qr.status} />
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs uppercase">
                      {qr.qr_type}
                    </span>
                  </div>
                  {qr.amount && <p>Amount: {qr.amount} TZS</p>}
                  {qr.bill_number && <p>Bill: {qr.bill_number}</p>}
                  <p>CRC: {qr.crc}</p>
                  <p>Version: {qr.version}</p>
                  <p>Created: {formatDateTime(qr.created_at)}</p>
                  {qr.expires_at && <p>Expires: {formatDateTime(qr.expires_at)}</p>}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="payload" className="mt-4 space-y-2">
              <textarea
                readOnly
                className="h-40 w-full rounded-md border border-input bg-muted p-3 font-mono text-xs"
                value={qr.tlv_payload}
              />
              <Button size="sm" variant="outline" onClick={() => onCopyPayload(qr.tlv_payload)}>
                Copy payload
              </Button>
            </TabsContent>
            <TabsContent value="metadata" className="mt-4">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">QR ID</dt><dd className="font-mono text-xs break-all">{qr.id}</dd></div>
                <div><dt className="text-muted-foreground">Merchant ID</dt><dd className="font-mono text-xs break-all">{qr.merchant_id}</dd></div>
                <div><dt className="text-muted-foreground">POI method</dt><dd>{qr.poi_method}</dd></div>
                <div><dt className="text-muted-foreground">MCC</dt><dd>{qr.mcc}</dd></div>
                {qr.assets.png && <div><dt className="text-muted-foreground">PNG</dt><dd className="text-xs break-all">{qr.assets.png}</dd></div>}
                {qr.assets.svg && <div><dt className="text-muted-foreground">SVG</dt><dd className="text-xs break-all">{qr.assets.svg}</dd></div>}
                {qr.reference_label && revealInternal && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Internal routing ID</dt>
                    <dd className="font-mono">{qr.reference_label}</dd>
                    <p className="text-xs text-muted-foreground">Not for payer use</p>
                  </div>
                )}
              </dl>
              {canRevealInternalId(user) && qr.reference_label && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => setShowInternal((v) => !v)}
                >
                  {showInternal ? 'Hide' : 'Reveal'} internal routing ID
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </div>
        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
