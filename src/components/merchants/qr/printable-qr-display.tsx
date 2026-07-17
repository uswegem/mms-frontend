'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { TanqrDisplayLayout, tanqrDisplayPrintStyles } from './tanqr-display-layout';
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
      <style>${tanqrDisplayPrintStyles()}</style></head>
      <body><div class="tanqr-print-root">${content.innerHTML}</div></body></html>
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
        <div className="flex justify-center px-6 py-6">
          <div ref={printRef}>
            <TanqrDisplayLayout
              alias={qr.alias}
              merchantName={qr.merchant_name}
              tlvPayload={qr.tlv_payload}
              assets={qr.assets}
              qrSize={240}
            />
          </div>
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
