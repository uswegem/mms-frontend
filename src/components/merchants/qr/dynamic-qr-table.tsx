'use client';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { QrImage } from './qr-image';
import { QrStatusBadge } from './qr-status-badge';
import { formatDateTime } from '@/lib/format';
import { resolveAssetUrl } from '@/lib/merchant-qr-api';
import { cn } from '@/lib/utils';
import type { MerchantQrCode } from '@/types/merchant-qr';

interface DynamicQrTableProps {
  items: MerchantQrCode[];
  canDisable: boolean;
  canDownload: boolean;
  onView: (qr: MerchantQrCode) => void;
  onPrint: (qr: MerchantQrCode) => void;
  onCopyPayload: (payload: string) => void;
  onDisable: (qr: MerchantQrCode) => void;
}

export function DynamicQrTable({
  items,
  canDisable,
  canDownload,
  onView,
  onPrint,
  onCopyPayload,
  onDisable,
}: DynamicQrTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No dynamic QR codes generated yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Preview</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Bill</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((qr) => (
            <TableRow key={qr.id}>
              <TableCell>
                <button type="button" onClick={() => onView(qr)}>
                  <QrImage tlvPayload={qr.tlv_payload} assets={qr.assets} size={56} />
                </button>
              </TableCell>
              <TableCell className="font-medium">{qr.amount ?? '—'}</TableCell>
              <TableCell className="max-w-[120px] truncate text-xs">{qr.bill_number ?? '—'}</TableCell>
              <TableCell className="max-w-[100px] truncate text-xs">{qr.reference_label ?? '—'}</TableCell>
              <TableCell><QrStatusBadge status={qr.status} /></TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {qr.expires_at ? formatDateTime(qr.expires_at) : '—'}
              </TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {formatDateTime(qr.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onView(qr)}>View</Button>
                  {canDownload && resolveAssetUrl(qr.assets.png) && (
                    <a
                      href={resolveAssetUrl(qr.assets.png)}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                    >
                      DL
                    </a>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onPrint(qr)}>Print</Button>
                  <Button size="sm" variant="ghost" onClick={() => onCopyPayload(qr.tlv_payload)}>Copy</Button>
                  {canDisable && qr.status === 'active' && (
                    <Button size="sm" variant="ghost" className="text-[var(--destructive)]" onClick={() => onDisable(qr)}>
                      Disable
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
