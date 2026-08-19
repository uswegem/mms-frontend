'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { listTransactions, type Payment } from '@/lib/transactions-api';
import {
  createDispute,
  DISPUTE_REASON_LABELS,
  DISPUTE_STAGE_LABELS,
  disputeSlaDeadline,
  isDisputeTerminal,
  listDisputes,
  type Dispute,
  type DisputeReason,
} from '@/lib/disputes-api';
import { formatCurrency, formatDateTime } from '@/lib/format';

const STAGE_PILL: Record<Dispute['stage'], string> = {
  INVESTIGATION: 'bg-danger-bg text-danger-text',
  EVIDENCE_REQUESTED: 'bg-track text-text-body',
  REFUND_PENDING_CHECKER: 'bg-warning-bg text-warning-text',
  RESOLVED_REFUNDED: 'bg-success-bg text-success-text',
  RESOLVED_NO_REFUND: 'bg-success-bg text-success-text',
  REJECTED: 'bg-track text-text-muted',
};

function slaCell(d: Dispute): { label: string; danger: boolean } {
  if (isDisputeTerminal(d.stage)) return { label: 'Closed', danger: false };
  const deadline = disputeSlaDeadline(d);
  const msLeft = deadline.getTime() - Date.now();
  if (msLeft <= 0) return { label: 'Breached', danger: true };
  const hrsLeft = msLeft / 3_600_000;
  if (hrsLeft < 24) return { label: `${Math.round(hrsLeft)}h left`, danger: hrsLeft < 6 };
  return { label: `${Math.round(hrsLeft / 24)}d left`, danger: false };
}

export default function MerchantDisputesPage() {
  const { accessToken, user } = useAuth();
  const token = accessToken ?? '';
  const merchantId = user?.merchantId ?? '';
  const queryClient = useQueryClient();
  const [showLogForm, setShowLogForm] = useState(false);

  const canWrite = user?.permissions?.includes('dispute:write');

  const disputesQuery = useQuery({
    queryKey: ['disputes', merchantId],
    queryFn: () => listDisputes(token, { merchantId }),
    enabled: !!accessToken && !!merchantId,
  });

  const items = disputesQuery.data?.items ?? [];
  const open = items.filter((d) => !isDisputeTerminal(d.stage));
  const breaching = open.filter((d) => slaCell(d).danger);

  return (
    <div className="-m-6 flex flex-col gap-4 p-[26px_34px_34px]">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">
            Disputes &amp; refunds
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {open.length} open
            {breaching.length > 0 && ` · ${breaching.length} breaching SLA`}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowLogForm((s) => !s)}
            className="rounded-[9px] bg-button-primary px-3.5 py-[9px] text-[13px] font-medium text-white hover:bg-button-primary-hover"
          >
            Log a dispute
          </button>
        )}
      </div>

      {showLogForm && (
        <LogDisputeForm
          token={token}
          merchantId={merchantId}
          onClose={() => setShowLogForm(false)}
          onLogged={async () => {
            setShowLogForm(false);
            await queryClient.invalidateQueries({ queryKey: ['disputes'] });
          }}
        />
      )}

      <div className="rounded-[14px] border border-border-default bg-surface">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-y border-border-hairline text-[12px] font-medium text-text-muted">
              <th className="px-5 py-3 text-left font-medium">Case</th>
              <th className="px-2 py-3 text-left font-medium">Reason</th>
              <th className="px-2 py-3 text-left font-medium">TIPS common ref</th>
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
                  No disputes logged yet.
                </td>
              </tr>
            ) : (
              items.map((d, i) => {
                const sla = slaCell(d);
                return (
                  <tr
                    key={d.id}
                    className={i < items.length - 1 ? 'border-b border-border-row' : ''}
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/merchant/disputes/${d.id}`}
                        className="font-mono text-[12px] text-accent-link hover:text-accent-link-hover"
                      >
                        {d.caseNo}
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-text-body">{DISPUTE_REASON_LABELS[d.reason]}</td>
                    <td className="px-2 py-3 font-mono text-[12px] text-text-muted">
                      {d.payment.tipsEndToEndId}
                    </td>
                    <td className="px-2 py-3 text-right font-medium tabular-nums text-text-primary">
                      {formatCurrency(Number(d.disputedAmount), d.currency)}
                    </td>
                    <td className="px-2 py-3">
                      <span className={sla.danger ? 'text-danger-text' : 'text-text-muted'}>
                        {sla.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-[20px] px-2.5 py-1 text-[11.5px] font-medium ${STAGE_PILL[d.stage]}`}
                      >
                        {DISPUTE_STAGE_LABELS[d.stage]}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogDisputeForm({
  token,
  merchantId,
  onClose,
  onLogged,
}: {
  token: string;
  merchantId: string;
  onClose: () => void;
  onLogged: () => Promise<void>;
}) {
  const [paymentId, setPaymentId] = useState('');
  const [reason, setReason] = useState<DisputeReason>('DUPLICATE_PAYMENT');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentsQuery = useQuery({
    queryKey: ['merchant-recent-payments-for-dispute'],
    queryFn: () => listTransactions(token, { status: 'SUCCESS', pageSize: 25 }),
    enabled: !!token,
  });

  const payments = paymentsQuery.data?.items ?? [];
  const selected = payments.find((p) => p.id === paymentId);

  function selectPayment(p: Payment) {
    setPaymentId(p.id);
    setAmount(p.amount);
  }

  async function handleSubmit() {
    if (!paymentId || !description.trim() || !amount) return;
    setBusy(true);
    setError(null);
    try {
      await createDispute(token, {
        merchantId,
        paymentId,
        raisedBy: 'MERCHANT',
        reason,
        description: description.trim(),
        disputedAmount: Number(amount),
      });
      await onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log this dispute');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-[14px] border border-border-default bg-surface p-5">
      <p className="text-[13px] font-semibold text-text-primary">Log a dispute</p>

      <div>
        <p className="mb-1.5 text-[12px] text-text-muted">Select the payment</p>
        <div className="flex max-h-[180px] flex-col gap-1.5 overflow-y-auto">
          {paymentsQuery.isLoading && (
            <p className="text-[12.5px] text-text-muted">Loading recent payments…</p>
          )}
          {!paymentsQuery.isLoading && payments.length === 0 && (
            <p className="text-[12.5px] text-text-muted">No successful payments to dispute yet.</p>
          )}
          {payments.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPayment(p)}
              className={`flex items-center justify-between rounded-[9px] border px-3 py-2 text-left text-[12.5px] transition-colors ${
                p.id === paymentId
                  ? 'border-accent bg-page'
                  : 'border-border-default hover:border-[#c9c9c3]'
              }`}
            >
              <span>
                <span className="font-mono text-text-muted">{p.tipsEndToEndId}</span>
                <span className="ml-2 text-text-body">{formatDateTime(p.receivedAt)}</span>
              </span>
              <span className="font-mono tabular-nums text-text-primary">
                {formatCurrency(Number(p.amount), p.currency)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <>
          <div>
            <p className="mb-1.5 text-[12px] text-text-muted">Reason</p>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as DisputeReason)}
              className="w-full rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
            >
              {Object.entries(DISPUTE_REASON_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1.5 text-[12px] text-text-muted">What happened?</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the issue…"
              className="w-full rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
            />
          </div>

          <div>
            <p className="mb-1.5 text-[12px] text-text-muted">
              Disputed amount (up to {formatCurrency(Number(selected.amount), selected.currency)})
            </p>
            <input
              type="number"
              value={amount}
              min={0}
              max={Number(selected.amount)}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
            />
          </div>
        </>
      )}

      {error && <p className="text-[12.5px] text-danger-text">{error}</p>}

      <div className="flex gap-2">
        <button
          disabled={!selected || !description.trim() || !amount || busy}
          onClick={() => void handleSubmit()}
          className="rounded-[9px] bg-button-primary px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Submitting…' : 'Submit dispute'}
        </button>
        <button
          onClick={onClose}
          className="rounded-[9px] border border-border-default bg-surface px-3.5 py-2 text-[12.5px] text-text-body hover:border-[#c9c9c3]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
