'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { listTransactions, type Payment } from '@/lib/transactions-api';
import { listSettlements } from '@/lib/settlements-api';
import { getMerchant } from '@/lib/merchants-api';
import { getMerchantAlias } from '@/lib/alias-api';
import { getKycUpgradeStatus } from '@/lib/kyc-upgrade-api';
import { formatCurrency, formatDateTime } from '@/lib/format';

function initials(email?: string): string {
  if (!email) return '—';
  const name = email.split('@')[0];
  return name.slice(0, 2).toUpperCase();
}

function statusPillColor(status: Payment['status']): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-success-bg text-success-text';
    case 'FAILED':
      return 'bg-danger-bg text-danger-text';
    case 'REVERSED':
    case 'REFUND_PENDING':
      return 'bg-track text-text-muted';
    default:
      return 'bg-warning-bg text-warning-text';
  }
}

export default function MerchantDashboardPage() {
  const { user, accessToken } = useAuth();
  const merchantId = user?.merchantId;

  const { data: merchant } = useQuery({
    queryKey: ['merchant-dashboard-profile', merchantId],
    queryFn: () => getMerchant(accessToken!, merchantId!),
    enabled: Boolean(accessToken && merchantId),
  });

  const { data: alias } = useQuery({
    queryKey: ['merchant-dashboard-alias', merchantId],
    queryFn: () => getMerchantAlias(accessToken!, merchantId!),
    enabled: Boolean(accessToken && merchantId),
  });

  const { data: recent } = useQuery({
    queryKey: ['merchant-dashboard-transactions'],
    queryFn: () => listTransactions(accessToken!, { pageSize: 5 }),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  });

  const { data: pending } = useQuery({
    queryKey: ['merchant-dashboard-settlements'],
    queryFn: () => listSettlements(accessToken!, { status: 'SWEPT', pageSize: 50 }),
    enabled: Boolean(accessToken),
  });

  const { data: kycStatus } = useQuery({
    queryKey: ['merchant-dashboard-kyc-upgrade'],
    queryFn: () => getKycUpgradeStatus(accessToken!),
    enabled: Boolean(accessToken),
  });

  const todayPayments = recent?.items.filter((p) => p.status === 'SUCCESS') ?? [];
  const collectedToday = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const avgTicket = todayPayments.length ? collectedToday / todayPayments.length : 0;
  const pendingTotal =
    pending?.items.reduce((sum, c) => sum + Number(c.netAmount ?? 0), 0) ?? 0;

  return (
    <div className="-m-6 flex flex-col">
      {/* Header band — handoff §dash: 26px 34px 18px, border-hairline bottom, space-between */}
      <div className="flex items-end justify-between border-b border-border-hairline px-[34px] py-[18px] pt-[26px]">
        <div>
          <p className="eyebrow mb-1.5">
            ALIAS {alias?.alias8digit ?? '—'} · MCC {merchant?.mcc ?? '—'}
          </p>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-text-primary">
            {merchant?.tradingName ?? 'Merchant'}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {[merchant?.profile?.city, merchant?.status].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-[20px] border border-border-default bg-surface px-3 py-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-success" />
            <span className="text-[12.5px] text-text-body">TIPS live</span>
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#131416] text-[12px] font-semibold text-white">
            {initials(user?.email)}
          </span>
        </div>
      </div>

      {/* Body — 22px 34px 34px, 18px gap */}
      <div className="flex flex-col gap-[18px] px-[34px] pb-[34px] pt-[22px]">
        {kycStatus?.breached && (
          <Link
            href="/merchant/kyc-upgrade"
            className="flex items-center justify-between rounded-[14px] border border-warning-border bg-warning-bg px-5 py-3.5 transition-colors hover:border-[#dfae70]"
          >
            <span className="text-[13px] text-warning-text">
              <span className="font-semibold">Full KYC required to keep selling</span> — you have
              crossed the threshold for the lighter online-seller tier
            </span>
            <span className="text-[12.5px] font-medium text-warning-text">Start upgrade →</span>
          </Link>
        )}
        {/* KPI row — 4 equal columns, 14px gap */}
        <div className="grid grid-cols-4 gap-[14px]">
          <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
            <p className="text-[12.5px] text-text-muted">Collected today</p>
            <p className="mt-[10px] text-[28px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
              {formatCurrency(collectedToday, 'TZS', true)}
            </p>
            <p className="mt-1 text-[12px] text-text-muted">
              {todayPayments.length} settled payment{todayPayments.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
            <p className="text-[12.5px] text-text-muted">Transactions</p>
            <p className="mt-[10px] text-[28px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
              {recent?.total ?? 0}
            </p>
            <p className="mt-1 text-[12px] text-text-muted">
              Avg {formatCurrency(avgTicket, 'TZS', true)}
            </p>
          </div>
          <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
            <p className="text-[12.5px] text-text-muted">Pending settlement</p>
            <p className="mt-[10px] text-[28px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
              {formatCurrency(pendingTotal, 'TZS', true)}
            </p>
            <p className="mt-1 text-[12px] text-text-muted">Sweep T+1 · 02:00</p>
          </div>
          {/* Exceptions: no reconciliation:read permission exists yet for
              merchant-scoped roles, so this can't call a real endpoint
              today — shown as an honest placeholder, not a fabricated
              number. Flagged separately; needs a merchant-facing
              reconciliation read permission before this is wireable. */}
          <div className="rounded-[14px] border border-warning-border bg-warning-bg p-[18px]">
            <p className="text-[12.5px] text-text-muted">Exceptions</p>
            <p className="mt-[10px] text-[28px] font-semibold tracking-[-0.02em] text-warning-text">
              —
            </p>
            <p className="mt-1 text-[12px] text-text-muted">Not yet available · review →</p>
          </div>
        </div>

        {/* Two-column row — 1.55fr 1fr, 14px gap */}
        <div className="grid grid-cols-[1.55fr_1fr] items-start gap-[14px]">
          {/* Live transactions table */}
          <div className="rounded-[14px] border border-border-default bg-surface">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-[15px] font-semibold text-text-primary">Live transactions</h2>
              <Link href="/merchant/transactions" className="text-[13px] font-medium text-accent-link hover:text-accent-link-hover">
                View all
              </Link>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-y border-border-hairline text-[12px] font-medium text-text-muted">
                  <th className="px-5 py-3 text-left font-medium">Time</th>
                  <th className="px-2 py-3 text-left font-medium">TIPS ref</th>
                  <th className="px-2 py-3 text-left font-medium">Payer</th>
                  <th className="px-2 py-3 text-left font-medium">Till</th>
                  <th className="px-2 py-3 text-right font-medium">TZS</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent?.items.length ? (
                  recent.items.map((p, i) => (
                    <tr
                      key={p.id}
                      className={i < recent.items.length - 1 ? 'border-b border-border-row' : ''}
                    >
                      <td className="px-5 py-3 text-text-body">{formatDateTime(p.receivedAt)}</td>
                      <td className="px-2 py-3 font-mono text-[12px] text-text-muted">
                        {p.tipsEndToEndId}
                      </td>
                      <td className="px-2 py-3 text-text-body">
                        {p.payerFsp ?? '—'}
                        {p.payerMsisdnMasked ? ` · ${p.payerMsisdnMasked}` : ''}
                      </td>
                      <td className="px-2 py-3 text-text-body">{p.terminalId ?? '—'}</td>
                      <td className="px-2 py-3 text-right font-medium tabular-nums text-text-primary">
                        {formatCurrency(Number(p.amount), p.currency)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-[20px] px-2.5 py-1 text-[11.5px] font-medium ${statusPillColor(p.status)}`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                      No transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Right column: Collection by till (pending per-till aggregation
              endpoint — placeholder), Quick actions (real links) */}
          <div className="flex flex-col gap-[14px]">
            <div className="rounded-[14px] border border-border-default bg-surface p-5">
              <h3 className="mb-3 text-[13px] font-semibold text-text-primary">
                Collection by till
              </h3>
              <p className="text-[12px] text-text-muted">
                Per-till breakdown needs a dedicated aggregation endpoint —
                not yet available.
              </p>
            </div>
            <div className="rounded-[14px] border border-border-default bg-surface p-5">
              <h3 className="mb-3 text-[13px] font-semibold text-text-primary">Quick actions</h3>
              <div className="flex flex-col gap-2">
                {[
                  { href: '/merchant/till', label: 'Take a payment at a till' },
                  { href: '/merchant/qr', label: 'Print a QR poster' },
                  { href: '/merchant/disputes', label: 'Log a dispute' },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center justify-between rounded-[10px] border border-border-default px-[13px] py-[11px] text-[13px] text-text-body transition-colors hover:border-[#c9c9c3] hover:bg-subtle"
                  >
                    {action.label}
                    <span className="text-text-disabled">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
