'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { RequestableStatusAction } from '@/lib/merchant-status-api';

const ACTION_LABELS: Record<RequestableStatusAction, string> = {
  SUSPEND: 'Request Suspend',
  REACTIVATE: 'Request Reactivate',
  MARK_DORMANT: 'Request Mark Dormant',
  CLOSE: 'Request Close',
};

interface RequestStatusChangeModalProps {
  open: boolean;
  action: RequestableStatusAction | null;
  merchantName?: string;
  onClose: () => void;
  onConfirm: (reason: string, notes?: string) => Promise<void>;
  loading?: boolean;
}

export function RequestStatusChangeModal({
  open,
  action,
  merchantName,
  onClose,
  onConfirm,
  loading,
}: RequestStatusChangeModalProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  if (!open || !action) return null;

  const canSubmit = reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold">{ACTION_LABELS[action]}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {merchantName ? `For ${merchantName}. ` : ''}
          This creates a pending approval request — a different user must approve it via the
          Checker Inbox before the status actually changes.
        </p>
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (required)</Label>
            <input
              id="reason"
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this change needed?"
            />
          </div>
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
            variant={action === 'CLOSE' ? 'destructive' : 'default'}
            disabled={loading || !canSubmit}
            onClick={() => void onConfirm(reason.trim(), notes.trim() || undefined)}
          >
            {loading ? 'Submitting…' : 'Submit for Approval'}
          </Button>
        </div>
      </div>
    </div>
  );
}
