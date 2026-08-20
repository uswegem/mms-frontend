'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  getReconciliationException,
  resolveReconciliationException,
  RECON_STATUS_LABELS,
  RECON_TYPE_LABELS,
  type ReconciliationExceptionStatus,
} from '@/lib/reconciliation-api';

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

export function ReconciliationDetailView({ id, listHref }: { id: string; listHref: string }) {
  const { accessToken, user } = useAuth();
  const token = accessToken ?? '';
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const canResolve = user?.permissions?.includes('reconciliation:resolve');

  const exceptionQuery = useQuery({
    queryKey: ['reconciliation-exception', id],
    queryFn: () => getReconciliationException(token, id),
    enabled: !!accessToken,
  });

  async function run(label: string, status: 'RESOLVED' | 'WRITTEN_OFF') {
    setError(null);
    try {
      await resolveReconciliationException(token, id, { status, notes: notes.trim() || undefined });
      setSuccess(`${label} completed.`);
      setNotes('');
      await queryClient.invalidateQueries({ queryKey: ['reconciliation-exception', id] });
      await queryClient.invalidateQueries({ queryKey: ['reconciliation-exceptions'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    }
  }

  if (exceptionQuery.isLoading || !exceptionQuery.data) {
    return <p className="py-20 text-center text-[13px] text-text-muted">Loading…</p>;
  }

  const exception = exceptionQuery.data;
  const open = exception.status === 'OPEN';

  return (
    <div className="-m-6 flex flex-col p-[26px_34px_34px]">
      <div className="mb-4 flex items-center gap-2.5 text-[13px]">
        <Link href={listHref} className="flex items-center gap-1.5 text-accent-link hover:text-accent-link-hover">
          <ArrowLeft className="h-3.5 w-3.5" /> Exception queue
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="font-mono text-text-muted">{exception.id.slice(0, 8)}…</span>
      </div>

      {error && (
        <div className="mb-4 rounded-[10px] border border-danger bg-danger-bg px-4 py-2.5 text-[13px] text-danger-text">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-[10px] border border-success-border bg-success-bg px-4 py-2.5 text-[13px] text-success-text">
          {success}
        </div>
      )}

      <div className="grid grid-cols-[1.4fr_1fr] items-start gap-5">
        <div className="flex flex-col gap-[18px] rounded-[14px] border border-border-default bg-surface p-[22px]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[17px] font-semibold text-text-primary">
                {RECON_TYPE_LABELS[exception.type]}
              </p>
              <p className="mt-[3px] text-[13px] text-text-muted">
                Detected during the {new Date(exception.cycleDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                })}{' '}
                auto-match run
              </p>
            </div>
            <span className={`rounded-[20px] px-[11px] py-1 text-[12px] font-medium ${STATUS_PILL[exception.status]}`}>
              {RECON_STATUS_LABELS[exception.status]}
              {open ? ` · ${ageLabel(exception.createdAt)}` : ''}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[12px] border border-border-default p-[14px]">
              <p className="text-[11.5px] text-text-muted">TIPS common ref</p>
              <p className="mt-[5px] font-mono text-[14px] text-text-primary">
                {exception.tipsEndToEndId ?? '—'}
              </p>
            </div>
            <div className="rounded-[12px] border border-border-default p-[14px]">
              <p className="text-[11.5px] text-text-muted">Amount</p>
              <p className="mt-[5px] font-mono text-[15px] font-semibold tabular-nums text-text-primary">
                {exception.amount ? formatCurrency(Number(exception.amount)) : '—'}
              </p>
            </div>
            <div className="rounded-[12px] border border-border-default p-[14px]">
              <p className="text-[11.5px] text-text-muted">Cycle date</p>
              <p className="mt-[5px] text-[14px] font-medium text-text-primary">
                {new Date(exception.cycleDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {open && canResolve ? (
            <div className="flex flex-col gap-2.5 border-t border-border-hairline pt-4">
              <p className="text-[13px] font-semibold text-text-primary">Resolution</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Investigation note — what you found and why this resolution is correct…"
                className="rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void run('Resolve', 'RESOLVED')}
                  className="rounded-[10px] border-2 border-accent px-[15px] py-2.5 text-[13px] font-medium text-text-primary hover:bg-page"
                >
                  Mark resolved
                </button>
                <button
                  onClick={() => void run('Write off', 'WRITTEN_OFF')}
                  className="rounded-[10px] border border-border-default px-[15px] py-2.5 text-[13px] text-text-body hover:border-[#c9c9c3]"
                >
                  Write off
                </button>
              </div>
            </div>
          ) : (
            !open && (
              <div className="rounded-[12px] border border-border-default bg-page p-4">
                <p className="text-[13px] font-semibold text-text-primary">
                  {RECON_STATUS_LABELS[exception.status]}
                </p>
                {exception.resolutionNotes && (
                  <p className="mt-1.5 text-[12.5px] text-text-body">{exception.resolutionNotes}</p>
                )}
                {exception.resolvedAt && (
                  <p className="mt-1.5 text-[12px] text-text-muted">
                    {RECON_STATUS_LABELS[exception.status]} {formatDateTime(exception.resolvedAt)}
                  </p>
                )}
              </div>
            )
          )}
        </div>

        <div className="rounded-[14px] border border-border-default bg-surface p-5">
          <p className="text-[13px] font-semibold text-text-primary">Case lifecycle</p>
          <div className="mt-3 flex flex-col gap-2.5 text-[12.5px]">
            <div className="flex gap-2.5">
              <div className="mt-[5px] h-2 w-2 flex-none rounded-full bg-border-input" />
              <div>
                <p className="text-text-body">Flagged by auto-match — no counterpart found</p>
                <p className="font-mono text-[11.5px] text-text-muted">{formatDateTime(exception.createdAt)}</p>
              </div>
            </div>
            {!open && exception.resolvedAt && (
              <div className="flex gap-2.5">
                <div className="mt-[5px] h-2 w-2 flex-none rounded-full bg-success" />
                <div>
                  <p className="text-text-body">{RECON_STATUS_LABELS[exception.status]}</p>
                  <p className="font-mono text-[11.5px] text-text-muted">{formatDateTime(exception.resolvedAt)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
