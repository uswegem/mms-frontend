'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  commentLabel?: string;
  commentPlaceholder?: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: (comment?: string) => Promise<void>;
  loading?: boolean;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  commentLabel = 'Comment (optional)',
  commentPlaceholder = 'Add a note for the record…',
  destructive = false,
  onClose,
  onConfirm,
  loading,
}: ConfirmModalProps) {
  const [comment, setComment] = useState('');

  if (!open) return null;

  function handleClose() {
    setComment('');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>

        <div className="mt-4 space-y-2">
          <Label htmlFor="confirm-comment">{commentLabel}</Label>
          <textarea
            id="confirm-comment"
            rows={3}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={commentPlaceholder}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={loading}
            onClick={() => void onConfirm(comment.trim() || undefined)}
          >
            {loading ? 'Processing…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
