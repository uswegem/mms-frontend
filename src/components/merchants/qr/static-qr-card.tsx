'use client';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QrImage } from './qr-image';
import { QrStatusBadge } from './qr-status-badge';
import { formatDateTime } from '@/lib/format';
import { resolveAssetUrl } from '@/lib/merchant-qr-api';
import { cn } from '@/lib/utils';
import type { MerchantQrCode } from '@/types/merchant-qr';

interface StaticQrCardProps {
  qr: MerchantQrCode;
  canRegenerate: boolean;
  canDisable: boolean;
  canDownload: boolean;
  onView: () => void;
  onPrint: () => void;
  onRegenerate: () => void;
  onDisable: () => void;
  onCopyPayload: (payload: string) => void;
}

export function StaticQrCard({
  qr,
  canRegenerate,
  canDisable,
  canDownload,
  onView,
  onPrint,
  onRegenerate,
  onDisable,
  onCopyPayload,
}: StaticQrCardProps) {
  const pngUrl = resolveAssetUrl(qr.assets.png);
  const svgUrl = resolveAssetUrl(qr.assets.svg);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Static Merchant QR</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3">
            <button type="button" onClick={onView} className="cursor-pointer">
              <QrImage tlvPayload={qr.tlv_payload} assets={qr.assets} size={200} />
            </button>
            <p className="text-xl font-bold tracking-wider">{qr.alias}</p>
            <p className="text-sm text-muted-foreground">{qr.merchant_name}</p>
            <div className="flex gap-2">
              <Badge variant="primary">STATIC</Badge>
              <QrStatusBadge status={qr.status} />
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Merchant</dt><dd>{qr.merchant_name}</dd></div>
              <div><dt className="text-muted-foreground">Lipa Namba</dt><dd className="font-mono">{qr.alias}</dd></div>
              <div><dt className="text-muted-foreground">MCC</dt><dd>{qr.mcc}</dd></div>
              {qr.city && <div><dt className="text-muted-foreground">City</dt><dd>{qr.city}</dd></div>}
              <div><dt className="text-muted-foreground">POI method</dt><dd>{qr.poi_method}</dd></div>
              <div><dt className="text-muted-foreground">Version</dt><dd>{qr.version}</dd></div>
              <div><dt className="text-muted-foreground">CRC</dt><dd className="font-mono">{qr.crc}</dd></div>
              <div><dt className="text-muted-foreground">Created</dt><dd>{formatDateTime(qr.created_at)}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={onView}>View</Button>
              {canDownload && pngUrl && (
                <a
                  href={pngUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  Download PNG
                </a>
              )}
              {canDownload && svgUrl && (
                <a
                  href={svgUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  Download SVG
                </a>
              )}
              <Button size="sm" variant="outline" onClick={onPrint}>Print</Button>
              <Button size="sm" variant="outline" onClick={() => onCopyPayload(qr.tlv_payload)}>Copy payload</Button>
              {canRegenerate && (
                <Button size="sm" variant="outline" onClick={onRegenerate}>Regenerate</Button>
              )}
              {canDisable && qr.status === 'active' && (
                <Button size="sm" variant="destructive" onClick={onDisable}>Disable</Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
