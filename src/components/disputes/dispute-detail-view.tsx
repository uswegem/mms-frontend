'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Paperclip } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { approveTask, listApprovalTasks, rejectTask } from '@/lib/approvals-api';
import {
  DISPUTE_REASON_LABELS,
  DISPUTE_STAGE_LABELS,
  disputeSlaDeadline,
  getDispute,
  getDisputeAuditLogs,
  initiateDisputeRefund,
  isDisputeTerminal,
  requestDisputeEvidence,
  resolveDisputeWithoutRefund,
  uploadDisputeEvidenceFile,
  type Dispute,
  type DisputeStage,
} from '@/lib/disputes-api';

/** listHref: back-office and merchant portal each have their own list route to return to. */
export function DisputeDetailView({ id, listHref }: { id: string; listHref: string }) {
  const { accessToken, user } = useAuth();
  const token = accessToken ?? '';
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const canWrite = user?.permissions?.includes('dispute:write');
  const canApproveTask = user?.permissions?.includes('approval:task:approve');
  const canRejectTask = user?.permissions?.includes('approval:task:reject');

  const disputeQuery = useQuery({
    queryKey: ['dispute', id],
    queryFn: () => getDispute(token, id),
    enabled: !!accessToken,
  });
  const auditQuery = useQuery({
    queryKey: ['dispute-audit', id],
    queryFn: () => getDisputeAuditLogs(token, id),
    enabled: !!accessToken,
  });
  const tasksQuery = useQuery({
    queryKey: ['approval-tasks-all'],
    queryFn: () => listApprovalTasks(token, ''),
    enabled: !!accessToken && (!!canApproveTask || !!canRejectTask),
  });

  const dispute = disputeQuery.data;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dispute', id] }),
      queryClient.invalidateQueries({ queryKey: ['dispute-audit', id] }),
      queryClient.invalidateQueries({ queryKey: ['approval-tasks-all'] }),
      queryClient.invalidateQueries({ queryKey: ['approval-tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['disputes'] }),
    ]);
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      setSuccess(`${label} completed.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    await run('Attach evidence', () => uploadDisputeEvidenceFile(token, id, file));
    setUploading(false);
  }

  if (disputeQuery.isLoading || !dispute) {
    return <p className="py-20 text-center text-[13px] text-text-muted">Loading…</p>;
  }

  const pendingTask = (tasksQuery.data?.data ?? []).find(
    (t) => t.entityId === id && t.entityType === 'DISPUTE_REFUND' && t.status === 'PENDING',
  );
  const isMaker = pendingTask?.makerId === user?.sub;
  const terminal = isDisputeTerminal(dispute.stage);
  const deadline = terminal ? null : disputeSlaDeadline(dispute);
  const breached = isPast(deadline);

  return (
    <div className="-m-6 flex flex-col p-[26px_34px_34px]">
      <div className="mb-4 flex items-center gap-2.5 text-[13px]">
        <Link href={listHref} className="flex items-center gap-1.5 text-accent-link hover:text-accent-link-hover">
          <ArrowLeft className="h-3.5 w-3.5" /> Disputes
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="font-mono text-text-muted">{dispute.caseNo}</span>
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
                {DISPUTE_REASON_LABELS[dispute.reason]}
              </p>
              <p className="mt-[3px] text-[13px] text-text-muted">
                Raised {formatDateTime(dispute.createdAt)} by {raisedByLabel(dispute.raisedBy)}
                {deadline && (
                  <>
                    {' '}
                    · {breached ? (
                      <span className="text-danger-text">SLA breached</span>
                    ) : (
                      <>SLA {formatDateTime(deadline.toISOString())}</>
                    )}
                  </>
                )}
              </p>
            </div>
            <StagePill stage={dispute.stage} />
          </div>

          {dispute.description && (
            <p className="text-[13px] leading-[1.6] text-text-body">{dispute.description}</p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Disputed amount">
              <span className="font-mono tabular-nums">
                {formatCurrency(Number(dispute.disputedAmount), dispute.currency)}
              </span>
            </StatCard>
            <StatCard label="TIPS common ref">
              <span className="font-mono text-[14px]">{dispute.payment.tipsEndToEndId}</span>
            </StatCard>
            <StatCard label="Payer">
              {dispute.payment.payerFsp || dispute.payment.payerMsisdnMasked
                ? `${dispute.payment.payerFsp ?? ''}${
                    dispute.payment.payerFsp && dispute.payment.payerMsisdnMasked ? ' · ' : ''
                  }${dispute.payment.payerMsisdnMasked ?? ''}`
                : '—'}
            </StatCard>
          </div>

          <div className="flex flex-col gap-2.5">
            <p className="text-[13px] font-semibold text-text-primary">Evidence</p>
            <div className="flex flex-wrap gap-2.5">
              {dispute.evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-2 rounded-[10px] border border-border-default px-3.5 py-2.5 text-[12.5px] text-text-body"
                >
                  <Paperclip className="h-3.5 w-3.5 text-text-muted" />
                  {ev.fileName}
                </div>
              ))}
              {dispute.evidence.length === 0 && (
                <p className="text-[12.5px] text-text-muted">No evidence attached yet.</p>
              )}
              {canWrite && !terminal && (
                <button
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-[10px] border border-dashed border-border-input px-3.5 py-2.5 text-[12.5px] text-text-muted transition-colors hover:border-[#c9c9c3] disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : '+ Attach'}
                </button>
              )}
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          {dispute.stage === 'REFUND_PENDING_CHECKER' && (
            <div className="flex flex-col gap-3 rounded-[12px] border border-warning-border bg-warning-bg p-4">
              <p className="text-[13.5px] font-semibold text-warning-text">Refund — maker-checker</p>
              <div className="flex gap-5 text-[12.5px] text-text-body">
                <div>
                  <p className="text-text-muted">Maker</p>
                  <p className="mt-[3px]">{pendingTask ? shortId(pendingTask.makerId) : 'The merchant'}</p>
                </div>
                <div>
                  <p className="text-text-muted">Checker</p>
                  <p className="mt-[3px]">Awaiting LFB back office</p>
                </div>
              </div>
              {pendingTask && (canApproveTask || canRejectTask) && (
                <RefundDecisionPanel
                  token={token}
                  taskId={pendingTask.id}
                  isMaker={isMaker}
                  canApprove={!!canApproveTask}
                  canReject={!!canRejectTask}
                  onDecided={refresh}
                />
              )}
              {!pendingTask && (canApproveTask || canRejectTask) && (
                <p className="text-[12.5px] text-text-muted">
                  This case&rsquo;s approval task is no longer pending — refresh to see the latest stage.
                </p>
              )}
            </div>
          )}

          {!terminal && dispute.stage !== 'REFUND_PENDING_CHECKER' && canWrite && (
            <MakerActionsPanel
              stage={dispute.stage}
              onRequestEvidence={() => run('Request evidence', () => requestDisputeEvidence(token, id))}
              onInitiateRefund={() => run('Initiate refund', () => initiateDisputeRefund(token, id))}
              onResolveNoRefund={(notes) =>
                run('Resolve without refund', () => resolveDisputeWithoutRefund(token, id, notes))
              }
            />
          )}

          {terminal && (
            <div className="rounded-[12px] border border-border-default bg-page p-4">
              <p className="text-[13px] font-semibold text-text-primary">
                {DISPUTE_STAGE_LABELS[dispute.stage]}
              </p>
              {dispute.resolutionNotes && (
                <p className="mt-1.5 text-[12.5px] text-text-body">{dispute.resolutionNotes}</p>
              )}
              {dispute.resolvedAt && (
                <p className="mt-1.5 text-[12px] text-text-muted">
                  Closed {formatDateTime(dispute.resolvedAt)}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-3 rounded-[14px] border border-border-default bg-surface p-5">
            <p className="text-[13px] font-semibold text-text-primary">Case timeline</p>
            <div className="flex flex-col gap-2.5 text-[12.5px]">
              {(auditQuery.data ?? []).map((log) => (
                <div key={log.id} className="flex gap-2.5">
                  <div className="mt-[5px] h-2 w-2 flex-none rounded-full bg-border-input" />
                  <div>
                    <p className="text-text-body">{auditActionLabel(log.action)}</p>
                    <p className="font-mono text-[11.5px] text-text-muted">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              {(auditQuery.data ?? []).length === 0 && (
                <p className="text-[12.5px] text-text-muted">No case activity recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-border-default p-[14px]">
      <p className="text-[11.5px] text-text-muted">{label}</p>
      <div className="mt-[5px] text-[14px] font-medium text-text-primary">{children}</div>
    </div>
  );
}

function StagePill({ stage }: { stage: DisputeStage }) {
  const styles: Record<DisputeStage, string> = {
    INVESTIGATION: 'bg-danger-bg text-danger-text',
    EVIDENCE_REQUESTED: 'bg-track text-text-body',
    REFUND_PENDING_CHECKER: 'bg-warning-bg text-warning-text',
    RESOLVED_REFUNDED: 'bg-success-bg text-success-text',
    RESOLVED_NO_REFUND: 'bg-success-bg text-success-text',
    REJECTED: 'bg-track text-text-muted',
  };
  return (
    <span className={`rounded-[20px] px-[11px] py-1 text-[12px] font-medium ${styles[stage]}`}>
      {DISPUTE_STAGE_LABELS[stage]}
    </span>
  );
}

function raisedByLabel(raisedBy: Dispute['raisedBy']): string {
  if (raisedBy === 'MERCHANT') return 'the merchant';
  if (raisedBy === 'PAYER') return 'the payer';
  return 'LFB operations';
}

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

function isPast(deadline: Date | null): boolean {
  return deadline ? deadline.getTime() < Date.now() : false;
}

function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    DISPUTE_LOGGED: 'Dispute logged',
    DISPUTE_EVIDENCE_ADDED: 'Evidence attached',
    DISPUTE_EVIDENCE_REQUESTED: 'Evidence requested',
    DISPUTE_REFUND_INITIATED: 'Refund initiated by maker',
    DISPUTE_REFUND_APPROVED: 'Refund approved by checker',
    DISPUTE_REFUND_REJECTED: 'Refund rejected by checker',
    DISPUTE_RESOLVED_NO_REFUND: 'Closed without a refund',
  };
  return labels[action] ?? action.replace(/_/g, ' ').toLowerCase();
}

function MakerActionsPanel({
  stage,
  onRequestEvidence,
  onInitiateRefund,
  onResolveNoRefund,
}: {
  stage: DisputeStage;
  onRequestEvidence: () => void;
  onInitiateRefund: () => void;
  onResolveNoRefund: (notes: string) => void;
}) {
  const [showResolve, setShowResolve] = useState(false);
  const [notes, setNotes] = useState('');

  return (
    <div className="flex flex-col gap-2.5 border-t border-border-hairline pt-4">
      <p className="text-[13px] font-semibold text-text-primary">Actions</p>
      <div className="flex flex-wrap gap-2">
        {stage === 'INVESTIGATION' && (
          <button
            onClick={onRequestEvidence}
            className="rounded-[9px] border border-border-default bg-surface px-3.5 py-2 text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]"
          >
            Request evidence
          </button>
        )}
        <button
          onClick={onInitiateRefund}
          className="rounded-[9px] bg-button-primary px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-button-primary-hover"
        >
          Initiate refund
        </button>
        <button
          onClick={() => setShowResolve((s) => !s)}
          className="rounded-[9px] border border-border-default bg-surface px-3.5 py-2 text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]"
        >
          Resolve without refund
        </button>
      </div>
      {showResolve && (
        <div className="flex flex-col gap-2 rounded-[10px] border border-border-default p-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Why is this dispute being closed without a refund?"
            className="rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
          <button
            disabled={!notes.trim()}
            onClick={() => {
              onResolveNoRefund(notes.trim());
              setShowResolve(false);
              setNotes('');
            }}
            className="self-start rounded-[9px] bg-button-primary px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm close
          </button>
        </div>
      )}
    </div>
  );
}

function RefundDecisionPanel({
  token,
  taskId,
  isMaker,
  canApprove,
  canReject,
  onDecided,
}: {
  token: string;
  taskId: string;
  isMaker: boolean;
  canApprove: boolean;
  canReject: boolean;
  onDecided: () => Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (isMaker) {
    return (
      <p className="text-[12.5px] text-text-muted">
        You initiated this refund — you cannot decide it yourself.
      </p>
    );
  }

  async function handleApprove() {
    setBusy(true);
    setLocalError(null);
    try {
      await approveTask(token, taskId, comment.trim() || undefined);
      await onDecided();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!remarks.trim()) {
      setLocalError('A reason is required to reject.');
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await rejectTask(token, taskId, remarks.trim());
      await onDecided();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {localError && <p className="text-[12px] text-danger-text">{localError}</p>}
      {!rejecting ? (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Optional comment for the record…"
            className="rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            {canApprove && (
              <button
                disabled={busy}
                onClick={() => void handleApprove()}
                className="flex items-center gap-1.5 rounded-[10px] bg-button-primary px-[17px] py-2.5 text-[13px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Approve refund
              </button>
            )}
            {canReject && (
              <button
                onClick={() => setRejecting(true)}
                className="rounded-[10px] border border-border-input bg-surface px-[17px] py-2.5 text-[13px] text-text-body hover:border-[#c9c9c3]"
              >
                Reject with reason
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            placeholder="Why is this refund being rejected?"
            className="rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => void handleReject()}
              className="rounded-[10px] border border-danger px-[17px] py-2.5 text-[13px] font-medium text-danger-text hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button
              onClick={() => setRejecting(false)}
              className="rounded-[10px] px-[17px] py-2.5 text-[13px] text-text-muted"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
