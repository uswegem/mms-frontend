'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MerchantStatusBadge } from '@/components/merchants/status-badge';
import type { StatusHistoryEntry } from '@/lib/merchant-status-api';
import { STATUS_ACTION_LABELS } from '@/lib/merchant-status-api';
import { formatDateTime } from '@/lib/format';

interface StatusHistoryTableProps {
  history: StatusHistoryEntry[];
  loading?: boolean;
}

export function StatusHistoryTable({ history, loading }: StatusHistoryTableProps) {
  if (loading) {
    return <p className="text-sm text-muted-foreground p-4">Loading history…</p>;
  }
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">No status changes recorded.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {history.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDateTime(entry.createdAt)}
            </TableCell>
            <TableCell className="text-sm">
              {STATUS_ACTION_LABELS[entry.action as keyof typeof STATUS_ACTION_LABELS] ??
                entry.action}
            </TableCell>
            <TableCell>
              <MerchantStatusBadge status={entry.fromStatus} />
            </TableCell>
            <TableCell>
              <MerchantStatusBadge status={entry.toStatus} />
            </TableCell>
            <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
              {entry.notes ?? entry.reason ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
