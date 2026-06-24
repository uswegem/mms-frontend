'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MerchantStatusBadge } from '@/components/merchants/status-badge';

interface ApprovalModalProps {
  open: boolean;
  merchantName: string;
  currentStatus: string;
  onClose: () => void;
  onApprove: (notes?: string) => Promise<void>;
  onReject: (notes?: string) => Promise<void>;
  loading?: boolean;
}

export function ApprovalModal({
  open,
  merchantName,
  currentStatus,
  onClose,
  onApprove,
  onReject,
  loading,
}: ApprovalModalProps) {
  const [notes, setNotes] = useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Checker Approval</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Review merchant <strong>{merchantName}</strong>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <MerchantStatusBadge status={currentStatus} />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="approval-notes">Review notes</Label>
          <textarea
            id="approval-notes"
            rows={3}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Compliance notes for audit trail…"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={() => void onReject(notes || undefined)}
          >
            Reject
          </Button>
          <Button
            disabled={loading}
            onClick={() => void onApprove(notes || undefined)}
          >
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
