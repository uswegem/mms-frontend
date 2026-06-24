'use client';

import { History } from 'lucide-react';
import { MerchantStatusBadge } from '@/components/merchants/status-badge';
import type { StatusHistoryEntry } from '@/lib/merchant-status-api';
import { formatDateTime } from '@/lib/format';

interface StatusTimelineProps {
  history: StatusHistoryEntry[];
  currentStatus: string;
}

export function StatusTimeline({ history, currentStatus }: StatusTimelineProps) {
  const events = [
    ...[...history].reverse().map((h) => ({
      label: `${h.fromStatus} → ${h.toStatus}`,
      time: h.createdAt,
      action: h.action,
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Current:</span>
        <MerchantStatusBadge status={currentStatus} />
      </div>
      <div className="space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transitions yet.</p>
        ) : (
          events.map((ev, i) => (
            <div key={i} className="flex gap-3 border-l-2 border-primary/20 pl-4">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{ev.label}</p>
                <p className="text-xs text-muted-foreground">
                  {ev.action} · {formatDateTime(ev.time)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
