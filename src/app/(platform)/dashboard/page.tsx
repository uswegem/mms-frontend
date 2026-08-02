'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  QrCode,
  Scale,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { HeroMetrics } from '@/components/dashboard/hero-metrics';
import { MerchantPortfolio } from '@/components/dashboard/merchant-portfolio';
import { OperationsPanel } from '@/components/dashboard/operations-panel';
import { ChartPanel } from '@/components/dashboard/chart-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { AreaChart } from '@/components/ui/area-chart';
import { BarChart } from '@/components/ui/bar-chart';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { listMerchants } from '@/lib/merchants-api';
import { formatCurrency, formatNumber } from '@/lib/format';
import {
  DASHBOARD_PREVIEW,
  PENDING_APPROVALS,
  RECENT_TRANSACTIONS,
  REVENUE_TREND,
  TRANSACTION_VOLUME,
} from '@/lib/mock-dashboard';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { accessToken, user } = useAuth();

  const merchantsQuery = useQuery({
    queryKey: ['dashboard-merchants'],
    queryFn: () => listMerchants(accessToken!, 1, 100),
    enabled: !!accessToken && user?.permissions?.includes('merchant:read'),
  });

  const merchants = merchantsQuery.data?.data ?? [];
  const total = merchantsQuery.data?.meta.total ?? merchants.length;
  const active = merchants.filter((m) => m.status === 'ACTIVE').length;
  const dormant = merchants.filter((m) => m.status === 'DORMANT').length;
  const suspended = merchants.filter((m) => m.status === 'SUSPENDED').length;
  const pending = merchants.filter((m) =>
    ['DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL'].includes(m.status),
  ).length;

  const successRate = (
    ((DASHBOARD_PREVIEW.todayTransactions - DASHBOARD_PREVIEW.failedTransactions) /
      DASHBOARD_PREVIEW.todayTransactions) *
    100
  ).toFixed(1);

  const weekTotal = TRANSACTION_VOLUME.reduce((s, d) => s + d.value, 0);
  const revenueLatest = REVENUE_TREND[REVENUE_TREND.length - 1].value;

  return (
    <div className="space-y-6">
      <DashboardHeader
        userName={user?.email}
        onRefresh={() => void queryClient.invalidateQueries({ queryKey: ['dashboard-merchants'] })}
        isRefreshing={merchantsQuery.isFetching}
      />

      {/* Primary KPI strip */}
      <HeroMetrics
        metrics={[
          {
            label: 'Gross Volume',
            value: formatCurrency(DASHBOARD_PREVIEW.todayVolume, 'TZS', true),
            change: { value: 12.4, label: 'vs yesterday' },
            sublabel: "Today's payment volume",
          },
          {
            label: 'Transactions',
            value: formatNumber(DASHBOARD_PREVIEW.todayTransactions),
            change: { value: 8.2, label: 'vs yesterday' },
            sublabel: `${DASHBOARD_PREVIEW.failedTransactions} failed · ${successRate}% success`,
          },
          {
            label: 'Merchants',
            value: formatNumber(total),
            change: { value: 4.2, label: 'vs last month' },
            sublabel: `${active} active · ${pending} pending onboarding`,
          },
          {
            label: 'Revenue MTD',
            value: formatCurrency(DASHBOARD_PREVIEW.revenueMtd, 'TZS', true),
            change: { value: 8.3, label: 'vs last month' },
            sublabel: 'MDR & acquirer fees',
          },
        ]}
      />

      {/* Main analytics grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left — charts */}
        <div className="space-y-6 lg:col-span-8">
          <div className="grid gap-6 md:grid-cols-2">
            <ChartPanel
              title="Transaction Volume"
              description="Daily count — last 7 days"
              summary={{
                label: 'Week total',
                value: formatNumber(weekTotal),
                change: '+14.2% vs prior week',
              }}
              badge="Live preview"
            >
              <BarChart data={TRANSACTION_VOLUME} height={180} />
            </ChartPanel>

            <ChartPanel
              title="Revenue Analytics"
              description="MDR revenue — millions TZS"
              summary={{
                label: 'Current month',
                value: `${revenueLatest}M`,
                change: '+5.4% vs May',
              }}
              badge="Live preview"
            >
              <AreaChart data={REVENUE_TREND} height={180} formatValue={(v) => `${v}M`} />
            </ChartPanel>
          </div>

          {/* Recent transactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
                <CardDescription className="text-xs">Latest payment activity across the network</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Preview data</Badge>
                <Link href="/transactions">
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    View all <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {RECENT_TRANSACTIONS.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                      {tx.status === 'SUCCESS' ? '✓' : tx.status === 'FAILED' ? '✕' : '…'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{tx.merchant}</p>
                        <Badge variant={statusBadgeVariant(tx.status)} className="shrink-0 text-[10px]">
                          {tx.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {tx.id} · {tx.channel}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(tx.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{tx.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right — portfolio & ops */}
        <div className="space-y-6 lg:col-span-4">
          <MerchantPortfolio
            total={total}
            items={[
              { label: 'Active', count: active, color: 'var(--brand-yellow)', bg: 'var(--accent-muted)' },
              { label: 'Pending', count: pending, color: 'var(--brand-black)', bg: 'var(--warning-muted)' },
              { label: 'Dormant', count: dormant, color: 'var(--muted-foreground)', bg: 'var(--info-muted)' },
              { label: 'Suspended', count: suspended, color: 'var(--brand-black)', bg: 'var(--destructive-muted)' },
            ]}
          />

          <OperationsPanel
            items={[
              {
                label: 'Settlement Batches',
                value: `${DASHBOARD_PREVIEW.settlementPending} pending`,
                status: 'warning',
                icon: Wallet,
              },
              {
                label: 'Reconciliation',
                value: `${DASHBOARD_PREVIEW.reconciliationOpen} exceptions`,
                status: 'warning',
                icon: Scale,
              },
              {
                label: 'QR Network',
                value: `${formatNumber(DASHBOARD_PREVIEW.qrScansToday)} scans`,
                status: 'healthy',
                icon: QrCode,
              },
              {
                label: 'School Collections',
                value: formatCurrency(DASHBOARD_PREVIEW.schoolCollections, 'TZS', true),
                status: 'healthy',
                icon: CheckCircle2,
              },
              {
                label: 'Failed Transactions',
                value: String(DASHBOARD_PREVIEW.failedTransactions),
                status: DASHBOARD_PREVIEW.failedTransactions > 20 ? 'critical' : 'neutral',
                icon: AlertTriangle,
              },
            ]}
          />

          {/* Approval queue */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Pending Approvals</CardTitle>
                  <CardDescription className="text-xs">Maker-checker queue</CardDescription>
                </div>
                <Badge variant="warning" className="text-[10px]">
                  {PENDING_APPROVALS.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              {PENDING_APPROVALS.map((apr, i) => (
                <div key={apr.id}>
                  <div className="flex gap-3 px-6 py-3">
                    <div className="mt-1 flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-[var(--brand-yellow)]" />
                      {i < PENDING_APPROVALS.length - 1 && (
                        <div className="mt-1 w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="truncate text-xs font-medium">{apr.entity}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {apr.type} · {apr.maker}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {apr.submitted}
                      </p>
                    </div>
                  </div>
                  {i < PENDING_APPROVALS.length - 1 && <Separator />}
                </div>
              ))}
              <div className="border-t border-border px-6 py-3">
                <Link href="/approvals">
                  <Button variant="outline" size="sm" className="h-8 w-full text-xs">
                    Review All Approvals
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
