'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { listTransactions, type Payment } from '@/lib/transactions-api';
import { formatCurrency, formatDateTime } from '@/lib/format';

const PAGE_SIZE = 20;

const STATUS_FILTERS: { label: string; value: Payment['status'] | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Settled', value: 'SUCCESS' },
  { label: 'Pending', value: 'INITIATED' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Refunded', value: 'REVERSED' },
];

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

export default function MerchantTransactionsPage() {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Payment['status'] | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-transactions', page, status],
    queryFn: () => listTransactions(accessToken!, { page, pageSize: PAGE_SIZE, status }),
    enabled: Boolean(accessToken),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const total = data?.total ?? 0;

  return (
    <div className="-m-6 flex flex-col p-[26px_34px_34px]">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">
            Transactions
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">{total} transaction{total === 1 ? '' : 's'}</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-[9px] border border-border-default bg-surface px-3 py-[7px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]">
            Export CSV
          </button>
          <button className="rounded-[9px] border border-border-default bg-surface px-3 py-[7px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]">
            Export PDF
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = f.value === status;
          return (
            <button
              key={f.label}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              className={
                active
                  ? 'rounded-[20px] bg-button-primary px-[13px] py-[6px] text-[12.5px] font-medium text-white'
                  : 'rounded-[20px] border border-border-default bg-surface px-[13px] py-[6px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]'
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-[14px] border border-border-default bg-surface">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-y border-border-hairline text-[12px] font-medium text-text-muted">
              <th className="px-5 py-3 text-left font-medium">Time</th>
              <th className="px-2 py-3 text-left font-medium">TIPS common ref</th>
              <th className="px-2 py-3 text-left font-medium">Payer FSP</th>
              <th className="px-2 py-3 text-left font-medium">Channel</th>
              <th className="px-2 py-3 text-right font-medium">TZS</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                  No transactions in this range.
                </td>
              </tr>
            )}
            {data?.items.map((p, i) => (
              <tr
                key={p.id}
                className={i < (data?.items.length ?? 0) - 1 ? 'border-b border-border-row' : ''}
              >
                <td className="px-5 py-3 text-text-body">{formatDateTime(p.receivedAt)}</td>
                <td className="px-2 py-3 font-mono text-[12px] text-text-muted">
                  {p.tipsEndToEndId}
                </td>
                <td className="px-2 py-3 text-text-body">{p.payerFsp ?? '—'}</td>
                <td className="px-2 py-3 text-text-body">{p.channel}</td>
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
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-[9px] border border-border-default px-3 py-[6px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-[12px] text-text-muted">
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-[9px] border border-border-default px-3 py-[6px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
