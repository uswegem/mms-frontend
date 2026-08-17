'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Receipt, Wallet, Zap } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { listTransactions } from '@/lib/transactions-api';
import { listSettlements } from '@/lib/settlements-api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';

export default function MerchantDashboardPage() {
  const { user, accessToken } = useAuth();

  const { data: recent } = useQuery({
    queryKey: ['merchant-dashboard-transactions'],
    queryFn: () => listTransactions(accessToken!, { pageSize: 5 }),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  });

  const { data: pending } = useQuery({
    queryKey: ['merchant-dashboard-settlements'],
    queryFn: () => listSettlements(accessToken!, { status: 'SWEPT', pageSize: 1 }),
    enabled: Boolean(accessToken),
  });

  const todayTotal =
    recent?.items
      .filter((p) => p.status === 'SUCCESS')
      .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground">Your merchant overview</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Recent collections"
          value={formatCurrency(todayTotal, 'TZS', true)}
          subtitle={`${recent?.items.filter((p) => p.status === 'SUCCESS').length ?? 0} settled payments (last 5)`}
          icon={Receipt}
          accent="success"
        />
        <StatCard
          title="Awaiting settlement"
          value={String(pending?.total ?? 0)}
          subtitle="Cycle(s) swept, posting to CBS"
          icon={Wallet}
          accent="info"
        />
        <StatCard
          title="Take a payment"
          value="→"
          subtitle="Open the till screen"
          icon={Zap}
          accent="warning"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent transactions</CardTitle>
          <Link href="/merchant/transactions">
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-1">
          {recent?.items.length ? (
            recent.items.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-0"
              >
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{p.tipsEndToEndId}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(p.receivedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium tabular-nums">{formatCurrency(Number(p.amount), p.currency)}</span>
                  <Badge variant={statusBadgeVariant(p.status)}>{p.status}</Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
