'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Merchant } from '@/lib/merchants-api';
import type { RequestableStatusAction } from '@/lib/merchant-status-api';

interface MerchantRowActionsMenuProps {
  merchant: Pick<Merchant, 'id' | 'status' | 'pendingStatusAction'>;
  canRequest: boolean;
  onRequestAction: (action: RequestableStatusAction) => void;
}

const OPTIONS_BY_STATUS: Record<string, { action: RequestableStatusAction; label: string }[]> = {
  ACTIVE: [
    { action: 'SUSPEND', label: 'Request Suspend' },
    { action: 'MARK_DORMANT', label: 'Request Mark Dormant' },
    { action: 'CLOSE', label: 'Request Close' },
  ],
  SUSPENDED: [
    { action: 'REACTIVATE', label: 'Request Reactivate' },
    { action: 'CLOSE', label: 'Request Close' },
  ],
  DORMANT: [
    { action: 'REACTIVATE', label: 'Request Reactivate' },
    { action: 'CLOSE', label: 'Request Close' },
  ],
};

export function MerchantRowActionsMenu({
  merchant,
  canRequest,
  onRequestAction,
}: MerchantRowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const options = OPTIONS_BY_STATUS[merchant.status] ?? [];
  const hasPending = !!merchant.pendingStatusAction;

  // Reserve the same width whether or not a kebab is actually shown for this
  // row, so "View" lands in the same x-position across every row instead of
  // zigzagging based on which rows happen to have available actions.
  if (!canRequest || options.length === 0) {
    return <div className="h-8 w-8 shrink-0" aria-hidden="true" />;
  }

  return (
    <div className="relative inline-block shrink-0" ref={ref}>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-border bg-card p-1 shadow-[var(--shadow-md)]">
          {hasPending && (
            <p className="px-2 py-1.5 text-xs text-[var(--warning)]">
              Pending: {merchant.pendingStatusAction} — awaiting checker approval
            </p>
          )}
          {options.map((opt) => (
            <button
              key={opt.action}
              type="button"
              disabled={hasPending}
              className={cn(
                'block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
                'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
              )}
              onClick={() => {
                setOpen(false);
                onRequestAction(opt.action);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
