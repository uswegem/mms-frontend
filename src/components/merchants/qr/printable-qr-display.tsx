'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { QrImage } from './qr-image';
import type { MerchantQrCode } from '@/types/merchant-qr';

interface PrintableQrDisplayProps {
  open: boolean;
  qr: MerchantQrCode | null;
  onClose: () => void;
  onDownloadPng?: () => void;
}

export function PrintableQrDisplay({
  open,
  qr,
  onClose,
  onDownloadPng,
}: PrintableQrDisplayProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!open || !qr) return null;

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=480,height=720');
    if (!win) return;
    win.document.write(`
      <html><head><title>TANQR - ${qr!.merchant_name}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 24px; }
        .logos { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 12px; color: #666; }
        .alias { font-size: 28px; font-weight: bold; letter-spacing: 2px; margin: 16px 0 8px; }
        .name { font-size: 16px; text-transform: uppercase; }
        .footer { margin-top: 24px; font-size: 12px; color: #444; }
        img { max-width: 280px; }
      </style></head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold">Print QR Display</h3>
        </div>
        <div ref={printRef} className="px-6 py-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
            <span className="font-semibold">TIPS</span>
            <span>Letshego Faidika Bank</span>
          </div>
          <div className="flex justify-center">
            <QrImage tlvPayload={qr.tlv_payload} assets={qr.assets} size={260} />
          </div>
          <p className="mt-4 text-center text-2xl font-bold tracking-widest">{qr.alias}</p>
          <p className="mt-1 text-center text-sm font-medium uppercase">{qr.merchant_name}</p>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Scan to Pay with TANQR
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onDownloadPng && (
            <Button variant="outline" onClick={onDownloadPng}>
              Download PNG
            </Button>
          )}
          <Button onClick={handlePrint}>Print</Button>
        </div>
      </div>
    </div>
  );
}
