'use client';

import QRCode from 'qrcode';
import { Download, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatLipaNamba } from '@/lib/format';
import { renderPosterToCanvas, printPosters } from '@/lib/poster-utils';
import { QrImage } from '@/components/merchants/qr/qr-image';

export interface PosterRecord {
  id: string;
  name: string;
  alias: string;
  tlvPayload: string | null;
  statusLabel: string;
}

interface StudentQrPosterProps {
  record: PosterRecord;
  onClose: () => void;
}

export function StudentQrPoster({ record, onClose }: StudentQrPosterProps) {
  const isActive = record.statusLabel === 'Active';
  const formatted = formatLipaNamba(record.alias);

  async function handleDownloadPng() {
    if (!record.tlvPayload) return;
    const canvas = await renderPosterToCanvas({
      name: record.name,
      alias: record.alias,
      tlvPayload: record.tlvPayload,
      statusLabel: record.statusLabel,
    });
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LipaNamba_${record.name.replace(/\s+/g, '_')}_${record.alias}.png`;
        a.click();
        URL.revokeObjectURL(url);
      },
      'image/png',
    );
  }

  async function handlePrint() {
    if (!record.tlvPayload) return;
    const qrDataUrl = await QRCode.toDataURL(record.tlvPayload, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    printPosters([
      {
        name: record.name,
        alias: record.alias,
        qrDataUrl,
        statusLabel: record.statusLabel,
      },
    ]);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-h-[95vh] w-full max-w-xs flex-col overflow-y-auto rounded-2xl shadow-2xl"
        style={{
          background:
            'linear-gradient(to bottom, #000000 0%, #1a1400 44%, #c8a400 100%)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-[62px] z-20 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header bar */}
        <div className="flex flex-shrink-0 items-center justify-between bg-white px-4 py-2.5">
          <span className="text-lg font-bold italic text-[#1a1a1a]">TIPS</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/letshego-faidika-logo.png"
            alt="Letshego Faidika Bank"
            className="h-10 object-contain"
            style={{ width: 'auto' }}
          />
        </div>

        {/* Poster body */}
        <div className="flex flex-col items-center px-6 pb-5 pt-4">
          <h1 className="text-center text-5xl font-black italic leading-none text-white">
            LIPA HAPA
          </h1>
          <h2
            className="mt-1 text-center text-xl font-bold"
            style={{ color: '#d4a500' }}
          >
            SCAN KULIPA
          </h2>

          {/* QR code — rendered via shared QrImage component */}
          <div className="mt-4">
            {record.tlvPayload ? (
              <QrImage
                tlvPayload={record.tlvPayload}
                size={200}
                className="rounded-xl"
              />
            ) : (
              <div className="flex h-[200px] w-[200px] items-center justify-center rounded-xl border border-dashed border-white/30 text-xs text-white/50">
                {record.tlvPayload === null ? 'Loading QR…' : 'Unavailable'}
              </div>
            )}
          </div>

          {/* Inactive banner */}
          {!isActive && (
            <div className="mt-3 w-full rounded-lg bg-red-700/90 px-3 py-2 text-center text-xs font-bold text-white">
              {record.statusLabel.toUpperCase()} — QR INACTIVE
            </div>
          )}

          {/* Lipa Namba label */}
          <p className="mt-3 text-center text-[10px] font-bold italic tracking-[3px] text-white/80">
            LIPA NAMBA
          </p>

          {/* Gold card */}
          <div
            className="mt-1 w-full rounded-2xl px-5 py-3"
            style={{ backgroundColor: '#d4a500' }}
          >
            <p
              className="text-center font-bold italic leading-tight tracking-widest text-black"
              style={{ fontSize: '26px' }}
            >
              {formatted}
            </p>
            <hr className="my-2 border-black/25" />
            <p
              className="text-center font-bold italic uppercase tracking-wide text-black"
              style={{ fontSize: '16px' }}
            >
              {record.name}
            </p>
          </div>

          {/* Footer */}
          <p
            className="mt-3 text-center text-[11px] font-bold italic"
            style={{ color: '#d4a500' }}
          >
            Lipa kutoka Benki au Mtandao wowote wa Simu
          </p>
        </div>

        {/* Action bar */}
        <div className="sticky bottom-0 flex gap-2 border-t border-white/20 bg-black/80 px-4 py-3 backdrop-blur-sm">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1 border-white/30 bg-transparent text-xs text-white hover:bg-white/10 hover:text-white"
            onClick={() => void handleDownloadPng()}
            disabled={!record.tlvPayload}
          >
            <Download className="h-3 w-3" />
            PNG
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1 border-white/30 bg-transparent text-xs text-white hover:bg-white/10 hover:text-white"
            onClick={() => void handlePrint()}
            disabled={!record.tlvPayload}
          >
            <Printer className="h-3 w-3" />
            Print / PDF
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
