'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  STATUS_ACTION_LABELS,
  type StatusAction,
} from '@/lib/merchant-status-api';

interface ChangeStatusModalProps {
  open: boolean;
  action: StatusAction | null;
  onClose: () => void;
  onConfirm: (notes?: string, reason?: string) => Promise<void>;
  loading?: boolean;
}

export function ChangeStatusModal({
  open,
  action,
  onClose,
  onConfirm,
  loading,
}: ChangeStatusModalProps) {
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  if (!open || !action) return null;

  const isReject = action === 'REJECT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold">
          {STATUS_ACTION_LABELS[action]}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm this status change. An audit record will be created.
        </p>
        <div className="mt-4 space-y-3">
          {isReject && (
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection reason code</Label>
              <input
                id="reason"
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. INCOMPLETE_KYC"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              rows={3}
              className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={isReject ? 'destructive' : 'default'}
            disabled={loading}
            onClick={() => void onConfirm(notes || undefined, reason || undefined)}
          >
            {loading ? 'Processing…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}
