'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { resolveAssetUrl } from '@/lib/merchant-qr-api';
import type { MerchantQrAsset } from '@/types/merchant-qr';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface QrImageProps {
  tlvPayload?: string;
  assets?: MerchantQrAsset;
  alt?: string;
  size?: number;
  className?: string;
}

export function QrImage({
  tlvPayload,
  assets,
  alt = 'TANQR code',
  size = 240,
  className,
}: QrImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const remote =
        resolveAssetUrl(assets?.svg) ?? resolveAssetUrl(assets?.png);
      if (remote) {
        if (!cancelled) {
          setSrc(remote);
          setLoading(false);
        }
        return;
      }
      if (!tlvPayload) {
        if (!cancelled) {
          setSrc(null);
          setLoading(false);
        }
        return;
      }
      try {
        const dataUrl = await QRCode.toDataURL(tlvPayload, {
          width: size,
          margin: 2,
          errorCorrectionLevel: 'M',
        });
        if (!cancelled) {
          setSrc(dataUrl);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSrc(null);
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tlvPayload, assets?.svg, assets?.png, size]);

  if (loading) {
    return <Skeleton className={cn('aspect-square', className)} style={{ width: size, height: size }} />;
  }

  if (!src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-dashed border-border bg-muted text-xs text-muted-foreground',
          className,
        )}
        style={{ width: size, height: size }}
      >
        QR unavailable
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded-md border border-border bg-white p-2', className)}
    />
  );
}
