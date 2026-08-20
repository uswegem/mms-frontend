'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { getMerchant } from '@/lib/merchants-api';
import {
  listReconciliationExceptions,
  runReconciliationMatch,
  RECON_STATUS_LABELS,
  RECON_TYPE_LABELS,
  type ReconciliationException,
  type ReconciliationExceptionStatus,
} from '@/lib/reconciliation-api';
import { formatCurrency } from '@/lib/format';

const STATUS_PILL: Record<ReconciliationExceptionStatus, string> = {
  OPEN: 'bg-warning-bg text-warning-text',
  RESOLVED: 'bg-success-bg text-success-text',
  WRITTEN_OFF: 'bg-track text-text-muted',
};

function ageDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
}

function ageLabel(createdAt: string): string {
  const days = ageDays(createdAt);
  if (days <= 0) return 'today';
  return `${days}d`;
}

export default function BackOfficeReconciliationPage() {
  const { accessToken, user } = useAuth();
  const token = accessToken ?? '';
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ReconciliationExceptionStatus | undefined>('OPEN');
  const [showRunForm, setShowRunForm] = useState(false);

  const canRead = user?.permissions?.includes('reconciliation:read');
  const canRun = user?.permissions?.includes('reconciliation:resolve');

  const query = useQuery({
    queryKey: ['reconciliation-exceptions', 'backoffice', statusFilter],
    queryFn: () => listReconciliationExceptions(token, { status: statusFilter, pageSize: 50 }),
    enabled: !!accessToken && !!canRead,
  });

  if (!canRead) {
    return (
      <p className="py-20 text-center text-[13px] text-text-muted">No reconciliation:read permission.</p>
    );
  }

  const items = query.data?.items ?? [];
  const open = items.filter((e) => e.status === 'OPEN');
  const suspenseTotal = open.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
  const oldestDays = open.length ? Math.max(...open.map((e) => ageDays(e.createdAt))) : 0;

  return (
    <div className="-m-6 flex flex-col gap-4 p-[26px_34px_34px]">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1.5">LFB back office · merchant operations</p>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">
            Reconciliation
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            TIPS settlement report vs. internal ledger — matched automatically at 03:00 daily.
          </p>
        </div>
        {canRun && (
          <button
            onClick={() => setShowRunForm((s) => !s)}
            className="rounded-[9px] border border-border-default bg-surface px-3.5 py-[9px] text-[13px] text-text-body hover:border-[#c9c9c3]"
          >
            Re-run match
          </button>
        )}
      </div>

      {showRunForm && (
        <RunMatchForm
          token={token}
          onDone={async () => {
            setShowRunForm(false);
            await queryClient.invalidateQueries({ queryKey: ['reconciliation-exceptions'] });
          }}
        />
      )}

      <div className="grid grid-cols-4 gap-[14px]">
        <div className="rounded-[14px] border border-warning-border bg-warning-bg p-[18px]">
          <p className="text-[12.5px] text-warning-text">Exceptions</p>
          <p className="mt-[9px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-warning-text">
            {open.length}
          </p>
          <p className="mt-0.5 text-[12px] text-warning-text">Awaiting review</p>
        </div>
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="text-[12.5px] text-text-muted">In suspense</p>
          <p className="mt-[9px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
            {formatCurrency(suspenseTotal, 'TZS', true)}
          </p>
          <p className="mt-0.5 text-[12px] text-text-muted">held pending resolution</p>
        </div>
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="text-[12.5px] text-text-muted">Oldest open</p>
          <p className="mt-[9px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
            {open.length ? `${oldestDays}d` : '—'}
          </p>
          <p className="mt-0.5 text-[12px] text-text-muted">across all merchants</p>
        </div>
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="text-[12.5px] text-text-muted">Total in this filter</p>
          <p className="mt-[9px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
            {query.data?.total ?? 0}
          </p>
        </div>
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
              <th className="px-2 py-2.5 text-left font-medium">Merchant</th>
              <th className="px-2 py-2.5 text-left font-medium">Type</th>
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
                  No exceptions in this filter.
                </td>
              </tr>
            ) : (
              items.map((exc, i) => (
                <ExceptionRow key={exc.id} exception={exc} token={token} isLast={i === items.length - 1} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExceptionRow({
  exception,
  token,
  isLast,
}: {
  exception: ReconciliationException;
  token: string;
  isLast: boolean;
}) {
  const merchantQuery = useQuery({
    queryKey: ['reconciliation-merchant', exception.merchantId],
    queryFn: () => getMerchant(token, exception.merchantId),
  });

  return (
    <tr className={isLast ? '' : 'border-b border-border-row'}>
      <td className="px-5 py-2.5">
        <Link
          href={`/reconciliation/${exception.id}`}
          className="font-mono text-[12px] text-accent-link hover:text-accent-link-hover"
        >
          {exception.id.slice(0, 8)}…
        </Link>
      </td>
      <td className="px-2 py-2.5 text-text-body">
        {merchantQuery.data?.tradingName ?? `${exception.merchantId.slice(0, 8)}…`}
      </td>
      <td className="px-2 py-2.5 text-text-body">{RECON_TYPE_LABELS[exception.type]}</td>
      <td className="px-2 py-2.5 text-right font-medium tabular-nums text-text-primary">
        {exception.amount ? formatCurrency(Number(exception.amount)) : '—'}
      </td>
      <td className="px-2 py-2.5 text-text-muted">{ageLabel(exception.createdAt)}</td>
      <td className="px-5 py-2.5">
        <span className={`rounded-[20px] px-2.5 py-1 text-[11.5px] font-medium ${STATUS_PILL[exception.status]}`}>
          {RECON_STATUS_LABELS[exception.status]}
        </span>
      </td>
    </tr>
  );
}

function RunMatchForm({ token, onDone }: { token: string; onDone: () => Promise<void> }) {
  const [merchantId, setMerchantId] = useState('');
  const [cycleDate, setCycleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleRun() {
    if (!merchantId.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const summary = await runReconciliationMatch(token, { merchantId: merchantId.trim(), cycleDate });
      setResult(`${summary.matched} matched, ${summary.exceptions} exception(s) raised.`);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Match run failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border-default bg-surface p-5">
      <p className="text-[13px] font-semibold text-text-primary">Re-run match</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1.5 text-[12px] text-text-muted">Merchant ID</p>
          <input
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            placeholder="UUID"
            className="w-[280px] rounded-[9px] border border-border-input bg-surface px-3 py-2 font-mono text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[12px] text-text-muted">Cycle date</p>
          <input
            type="date"
            value={cycleDate}
            onChange={(e) => setCycleDate(e.target.value)}
            className="rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
        </div>
        <button
          disabled={!merchantId.trim() || busy}
          onClick={() => void handleRun()}
          className="rounded-[9px] bg-button-primary px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Run match'}
        </button>
      </div>
      {result && <p className="text-[12.5px] text-success-text">{result}</p>}
      {error && <p className="text-[12.5px] text-danger-text">{error}</p>}
    </div>
  );
}
