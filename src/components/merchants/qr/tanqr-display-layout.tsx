'use client';

import { QrImage } from './qr-image';
import { TipsLogo } from './tips-logo';
import type { MerchantQrAsset } from '@/types/merchant-qr';
import { parseTanqrMerchantAccount } from '@/lib/tanqr-tlv';
import { cn } from '@/lib/utils';

export interface TanqrDisplayLayoutProps {
  alias: string;
  merchantName: string;
  tlvPayload?: string;
  assets?: MerchantQrAsset;
  qrSize?: number;
  acquirerSlogan?: string;
  className?: string;
}

/**
 * TANQR Annex 2 merchant-presented display layout.
 * Part A: TIPS logo · Part B: QR · Part C: Alias + merchant name · Part D: FSP slogan
 */
export function TanqrDisplayLayout({
  alias,
  merchantName,
  tlvPayload,
  assets,
  qrSize = 220,
  acquirerSlogan,
  className,
}: TanqrDisplayLayoutProps) {
  const { acquirerId, merchantId } = parseTanqrMerchantAccount(tlvPayload, alias);

  return (
    <div
      className={cn(
        'flex w-[min(100%,320px)] flex-col border-2 border-black bg-white text-black',
        className,
      )}
    >
      {/* Part A — Network facilitator logo */}
      <div className="flex items-center justify-center border-b border-black px-4 py-5">
        <TipsLogo className="h-14 w-auto max-w-[240px]" />
      </div>

      {/* Part B — QR code image */}
      <div className="flex items-center justify-center border-b border-black px-4 py-6">
        <QrImage
          tlvPayload={tlvPayload}
          assets={assets}
          size={qrSize}
          variant="display"
        />
      </div>

      {/* Part C — Merchant details */}
      <div className="flex flex-col items-center gap-3 border-b border-black px-4 py-5">
        <div className="min-w-[220px] border border-black bg-[#ececec] px-4 py-3 text-black">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide">Acquirer ID</p>
            <p className="font-mono text-xl font-bold tracking-[0.15em]">{acquirerId || '—'}</p>
          </div>
          <div className="mt-2 border-t border-black/25 pt-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide">Merchant ID</p>
            <p className="font-mono text-xl font-bold tracking-[0.15em]">{merchantId || '—'}</p>
          </div>
        </div>
        <p className="text-center text-sm font-bold uppercase tracking-wide text-black">
          {merchantName}
        </p>
      </div>

      {/* Part D — FSP branding */}
      <div className="flex min-h-[48px] items-center justify-center px-4 py-3">
        {acquirerSlogan ? (
          <p className="text-center text-xs text-gray-600">{acquirerSlogan}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Inline styles for print window — keeps printed output identical to on-screen display. */
export function tanqrDisplayPrintStyles(): string {
  return `
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; display: flex; justify-content: center; background: #fff; }
    .tanqr-print-root { width: 320px; border: 2px solid #000; background: #fff; color: #000; font-family: Arial, sans-serif; }
    .tanqr-print-root section { border-bottom: 1px solid #000; padding: 20px 16px; text-align: center; }
    .tanqr-print-root section:last-child { border-bottom: none; min-height: 48px; }
    .tanqr-print-root .alias-box { display: inline-block; min-width: 220px; border: 1px solid #000; background: #ececec; padding: 10px 16px; color: #000; }
    .tanqr-print-root .alias-box .field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .tanqr-print-root .alias-box .field-value { margin-top: 2px; font-family: monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.15em; }
    .tanqr-print-root .alias-box .field-divider { margin: 8px 0; border-top: 1px solid rgba(0,0,0,0.25); }
    .tanqr-print-root .merchant-name { margin-top: 12px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .tanqr-print-root img.qr-img { box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  `;
}
