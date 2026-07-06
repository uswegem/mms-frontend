'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CreateDynamicQrRequest } from '@/types/merchant-qr';

interface CreateDynamicQrModalProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (body: CreateDynamicQrRequest) => Promise<void>;
}

export function CreateDynamicQrModal({
  open,
  loading,
  onClose,
  onSubmit,
}: CreateDynamicQrModalProps) {
  const [amount, setAmount] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [referenceLabel, setReferenceLabel] = useState('');
  const [expiresIn, setExpiresIn] = useState('30');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount('');
      setBillNumber('');
      setReferenceLabel('');
      setExpiresIn('30');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function validate(): CreateDynamicQrRequest | null {
    const raw = amount.replace(/,/g, '').trim();
    if (!raw) {
      setError('Amount is required');
      return null;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0) {
      setError('Amount must be greater than zero with at most 2 decimals');
      return null;
    }
    if (billNumber.length > 25) {
      setError('Bill number must be at most 25 characters');
      return null;
    }
    if (referenceLabel.length > 25) {
      setError('Reference label must be at most 25 characters');
      return null;
    }
    const mins = Number(expiresIn);
    if (!Number.isFinite(mins) || mins <= 0) {
      setError('Expiry must be greater than zero minutes');
      return null;
    }
    setError(null);
    return {
      amount: raw,
      bill_number: billNumber || undefined,
      reference_label: referenceLabel || undefined,
      expires_in_minutes: mins,
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold">Create Dynamic QR</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Dynamic QR includes the payment amount and is used for a specific bill,
          invoice, or transaction.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="dyn-amount">Amount *</Label>
            <Input
              id="dyn-amount"
              placeholder="150000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="dyn-bill">Bill number</Label>
            <Input
              id="dyn-bill"
              maxLength={25}
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="dyn-ref">Reference label</Label>
            <Input
              id="dyn-ref"
              maxLength={25}
              value={referenceLabel}
              onChange={(e) => setReferenceLabel(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="dyn-expiry">Expires in (minutes)</Label>
            <Input
              id="dyn-expiry"
              type="number"
              min={1}
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            disabled={loading}
            onClick={() => {
              const body = validate();
              if (body) void onSubmit(body);
            }}
          >
            {loading ? 'Creating…' : 'Create QR'}
          </Button>
        </div>
      </div>
    </div>
  );
}
