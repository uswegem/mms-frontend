'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { getMerchant } from '@/lib/merchants-api';
import {
  DISPUTE_REASON_LABELS,
  DISPUTE_STAGE_LABELS,
  disputeSlaDeadline,
  isDisputeTerminal,
  listDisputes,
  type Dispute,
  type DisputeStage,
} from '@/lib/disputes-api';
import { formatCurrency } from '@/lib/format';

const STAGE_PILL: Record<DisputeStage, string> = {
  INVESTIGATION: 'bg-danger-bg text-danger-text',
  EVIDENCE_REQUESTED: 'bg-track text-text-body',
  REFUND_PENDING_CHECKER: 'bg-warning-bg text-warning-text',
  RESOLVED_REFUNDED: 'bg-success-bg text-success-text',
  RESOLVED_NO_REFUND: 'bg-success-bg text-success-text',
  REJECTED: 'bg-track text-text-muted',
};

const STAGE_FILTERS: { label: string; value: DisputeStage | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Investigation', value: 'INVESTIGATION' },
  { label: 'Evidence requested', value: 'EVIDENCE_REQUESTED' },
  { label: 'Refund pending checker', value: 'REFUND_PENDING_CHECKER' },
  { label: 'Resolved — refunded', value: 'RESOLVED_REFUNDED' },
  { label: 'Resolved — no refund', value: 'RESOLVED_NO_REFUND' },
  { label: 'Rejected', value: 'REJECTED' },
];

function slaCell(d: Dispute): { label: string; danger: boolean } {
  if (isDisputeTerminal(d.stage)) return { label: 'Closed', danger: false };
  const deadline = disputeSlaDeadline(d);
  const msLeft = deadline.getTime() - Date.now();
  if (msLeft <= 0) return { label: 'Breached', danger: true };
  const hrsLeft = msLeft / 3_600_000;
  if (hrsLeft < 24) return { label: `${Math.round(hrsLeft)}h left`, danger: hrsLeft < 6 };
  return { label: `${Math.round(hrsLeft / 24)}d left`, danger: false };
}

export default function BackOfficeDisputesPage() {
  const { accessToken, user } = useAuth();
  const token = accessToken ?? '';
  const [stage, setStage] = useState<DisputeStage | undefined>(undefined);

  const canRead = user?.permissions?.includes('dispute:read');

  const disputesQuery = useQuery({
    queryKey: ['disputes', 'all', stage],
    queryFn: () => listDisputes(token, { stage, limit: 50 }),
    enabled: !!accessToken && !!canRead,
  });

  if (!canRead) {
    return (
      <p className="py-20 text-center text-[13px] text-text-muted">No dispute:read permission.</p>
    );
  }

  const items = disputesQuery.data?.items ?? [];
  const open = items.filter((d) => !isDisputeTerminal(d.stage));
  const breaching = open.filter((d) => slaCell(d).danger);

  return (
    <div className="-m-6 flex flex-col gap-4 p-[26px_34px_34px]">
      <div>
        <p className="eyebrow mb-1.5">LFB back office · merchant operations</p>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">
          Disputes &amp; refunds
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">
          {open.length} open{breaching.length > 0 && ` · ${breaching.length} breaching SLA`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STAGE_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setStage(f.value)}
            className={
              stage === f.value
                ? 'rounded-[20px] bg-button-primary px-[13px] py-[6px] text-[12.5px] font-medium text-white'
                : 'rounded-[20px] border border-border-default bg-surface px-[13px] py-[6px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-[14px] border border-border-default bg-surface">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-y border-border-hairline text-[12px] font-medium text-text-muted">
              <th className="px-5 py-3 text-left font-medium">Case</th>
              <th className="px-2 py-3 text-left font-medium">Merchant</th>
              <th className="px-2 py-3 text-left font-medium">Reason</th>
              <th className="px-2 py-3 text-right font-medium">TZS</th>
              <th className="px-2 py-3 text-left font-medium">SLA</th>
              <th className="px-5 py-3 text-left font-medium">Stage</th>
            </tr>
          </thead>
          <tbody>
            {disputesQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                  No disputes match this filter.
                </td>
              </tr>
            ) : (
              items.map((d, i) => (
                <DisputeRow key={d.id} dispute={d} token={token} isLast={i === items.length - 1} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DisputeRow({ dispute, token, isLast }: { dispute: Dispute; token: string; isLast: boolean }) {
  const merchantQuery = useQuery({
    queryKey: ['dispute-merchant', dispute.merchantId],
    queryFn: () => getMerchant(token, dispute.merchantId),
  });
  const sla = slaCell(dispute);

  return (
    <tr className={isLast ? '' : 'border-b border-border-row'}>
      <td className="px-5 py-3">
        <Link
          href={`/disputes/${dispute.id}`}
          className="font-mono text-[12px] text-accent-link hover:text-accent-link-hover"
        >
          {dispute.caseNo}
        </Link>
      </td>
      <td className="px-2 py-3 text-text-body">
        {merchantQuery.data?.tradingName ?? `${dispute.merchantId.slice(0, 8)}…`}
      </td>
      <td className="px-2 py-3 text-text-body">{DISPUTE_REASON_LABELS[dispute.reason]}</td>
      <td className="px-2 py-3 text-right font-medium tabular-nums text-text-primary">
        {formatCurrency(Number(dispute.disputedAmount), dispute.currency)}
      </td>
      <td className="px-2 py-3">
        <span className={sla.danger ? 'text-danger-text' : 'text-text-muted'}>{sla.label}</span>
      </td>
      <td className="px-5 py-3">
        <span
          className={`rounded-[20px] px-2.5 py-1 text-[11.5px] font-medium ${STAGE_PILL[dispute.stage]}`}
        >
          {DISPUTE_STAGE_LABELS[dispute.stage]}
        </span>
      </td>
    </tr>
  );
}
