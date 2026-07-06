'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { GenerateStaticQrRequest } from '@/types/merchant-qr';

interface GenerateStaticQrModalProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (body: GenerateStaticQrRequest) => Promise<void>;
}

export function GenerateStaticQrModal({
  open,
  loading,
  onClose,
  onSubmit,
}: GenerateStaticQrModalProps) {
  const [purpose, setPurpose] = useState('Merchant static QR');
  const [forceRegenerate, setForceRegenerate] = useState(false);

  useEffect(() => {
    if (open) {
      setPurpose('Merchant static QR');
      setForceRegenerate(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Generate Static Merchant QR</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Static QR does not include an amount. The payer enters the amount in their
          banking or mobile money app.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="qr-purpose">Purpose (optional)</Label>
            <Input
              id="qr-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={forceRegenerate}
              onChange={(e) => setForceRegenerate(e.target.checked)}
            />
            Force regenerate (new payload version)
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            disabled={loading}
            onClick={() =>
              void onSubmit({
                purpose: purpose || undefined,
                force_regenerate: forceRegenerate,
              })
            }
          >
            {loading ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>
    </div>
  );
}
