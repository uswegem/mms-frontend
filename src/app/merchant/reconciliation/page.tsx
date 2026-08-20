'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import {
  listReconciliationExceptions,
  RECON_STATUS_LABELS,
  RECON_TYPE_LABELS,
  type ReconciliationExceptionStatus,
} from '@/lib/reconciliation-api';
import { formatCurrency } from '@/lib/format';

const STATUS_PILL: Record<ReconciliationExceptionStatus, string> = {
  OPEN: 'bg-warning-bg text-warning-text',
  RESOLVED: 'bg-success-bg text-success-text',
  WRITTEN_OFF: 'bg-track text-text-muted',
};

function ageLabel(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  return `${days}d`;
}

export default function MerchantReconciliationPage() {
  const { accessToken } = useAuth();
  const token = accessToken ?? '';
  const [statusFilter, setStatusFilter] = useState<ReconciliationExceptionStatus | undefined>('OPEN');

  const query = useQuery({
    queryKey: ['reconciliation-exceptions', 'merchant', statusFilter],
    queryFn: () => listReconciliationExceptions(token, { status: statusFilter, pageSize: 50 }),
    enabled: !!accessToken,
  });

  const items = query.data?.items ?? [];

  return (
    <div className="-m-6 flex flex-col gap-4 p-[26px_34px_34px]">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">
          Reconciliation
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">
          TIPS settlement report vs. your internal ledger — matched automatically each night.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['OPEN', 'RESOLVED', 'WRITTEN_OFF', undefined] as const).map((s) => (
          <button
            key={s ?? 'ALL'}
            onClick={() => setStatusFilter(s)}
            className={
              statusFilter === s
                ? 'rounded-[20px] bg-button-primary px-[13px] py-[6px] text-[12.5px] font-medium text-white'
                : 'rounded-[20px] border border-border-default bg-surface px-[13px] py-[6px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]'
            }
          >
            {s ? RECON_STATUS_LABELS[s] : 'All'}
          </button>
        ))}
      </div>

      <div className="rounded-[14px] border border-border-default bg-surface">
        <div className="border-b border-border-hairline px-5 py-[15px]">
          <p className="text-[15px] font-semibold text-text-primary">Exception queue</p>
          <p className="text-[12.5px] text-text-muted">Only unmatched or duplicate items surface here</p>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border-hairline text-[12px] font-medium text-text-muted">
              <th className="px-5 py-2.5 text-left font-medium">Case</th>
              <th className="px-2 py-2.5 text-left font-medium">Type</th>
              <th className="px-2 py-2.5 text-left font-medium">TIPS common ref</th>
              <th className="px-2 py-2.5 text-right font-medium">TZS</th>
              <th className="px-2 py-2.5 text-left font-medium">Age</th>
              <th className="px-5 py-2.5 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                  No exceptions in this filter — the nightly match has nothing to flag.
                </td>
              </tr>
            ) : (
              items.map((exc, i) => (
                <tr key={exc.id} className={i < items.length - 1 ? 'border-b border-border-row' : ''}>
                  <td className="px-5 py-2.5">
                    <Link
                      href={`/merchant/reconciliation/${exc.id}`}
                      className="font-mono text-[12px] text-accent-link hover:text-accent-link-hover"
                    >
                      {exc.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-text-body">{RECON_TYPE_LABELS[exc.type]}</td>
                  <td className="px-2 py-2.5 font-mono text-[12px] text-text-muted">
                    {exc.tipsEndToEndId ?? '—'}
                  </td>
                  <td className="px-2 py-2.5 text-right font-medium tabular-nums text-text-primary">
                    {exc.amount ? formatCurrency(Number(exc.amount)) : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-text-muted">{ageLabel(exc.createdAt)}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`rounded-[20px] px-2.5 py-1 text-[11.5px] font-medium ${STATUS_PILL[exc.status]}`}
                    >
                      {RECON_STATUS_LABELS[exc.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
