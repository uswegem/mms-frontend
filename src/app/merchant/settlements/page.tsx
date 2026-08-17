'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { listSettlements } from '@/lib/settlements-api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function MerchantSettlementsPage() {
  const { accessToken } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-settlements'],
    queryFn: () => listSettlements(accessToken!, { pageSize: 30 }),
    enabled: Boolean(accessToken),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settlement</h1>
        <p className="text-sm text-muted-foreground">Nightly sweep, MDR, and CBS posting per cycle</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cycle</TableHead>
            <TableHead className="text-right">Txns</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">MDR</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>CBS reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && data?.items.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                No settlement cycles yet — the nightly sweep runs at 02:00.
              </TableCell>
            </TableRow>
          )}
          {data?.items.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{formatDate(c.cycleDate)}</TableCell>
              <TableCell className="text-right tabular-nums">{c.transactionCount}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(Number(c.grossAmount))}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatCurrency(Number(c.mdrAmount))}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatCurrency(Number(c.netAmount))}
              </TableCell>
              <TableCell>
                <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {c.cbsPostingRef ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
