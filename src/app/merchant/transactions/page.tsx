'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { listTransactions } from '@/lib/transactions-api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 20;

export default function MerchantTransactionsPage() {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-transactions', page],
    queryFn: () => listTransactions(accessToken!, { page, pageSize: PAGE_SIZE }),
    enabled: Boolean(accessToken),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">{data?.total ?? 0} total</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>TIPS reference</TableHead>
            <TableHead>Payer FSP</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && data?.items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No transactions in this range.
              </TableCell>
            </TableRow>
          )}
          {data?.items.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="text-xs text-muted-foreground">{formatDateTime(p.receivedAt)}</TableCell>
              <TableCell className="font-mono text-xs">{p.tipsEndToEndId}</TableCell>
              <TableCell>{p.payerFsp ?? '—'}</TableCell>
              <TableCell>{p.channel}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatCurrency(Number(p.amount), p.currency)}
              </TableCell>
              <TableCell>
                <Badge variant={statusBadgeVariant(p.status)}>{p.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
