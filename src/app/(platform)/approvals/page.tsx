'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { RejectModal } from '@/components/ui/reject-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { approveTask, listApprovalTasks, rejectTask, type ApprovalTask } from '@/lib/approvals-api';
import { getMerchant } from '@/lib/merchants-api';
import { formatOnboardingStep, getOnboardingApplication } from '@/lib/onboarding-api';
import { DISPUTE_STAGE_LABELS, getDispute } from '@/lib/disputes-api';
import { formatCurrency } from '@/lib/format';

type ActivityFilter = 'ALL' | string;

/** Returns a compact relative-time string, e.g. "3d", "4h", "12m" */
function waitingSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function activityLabel(entityType: string): string {
  return entityType
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function isBreachingSla(createdAt: string): boolean {
  const hrs = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  return hrs >= 4;
}

function wasDecidedToday(decidedAt: string): boolean {
  const d = new Date(decidedAt);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function ApprovalsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('ALL');

  const canRead = user?.permissions?.includes('approval:task:read');
  const canApprove = user?.permissions?.includes('approval:task:approve');
  const canReject = user?.permissions?.includes('approval:task:reject');

  // Fetch everything once — KPIs and every filter chip below read from the
  // same dataset, rather than a fresh query per filter click.
  const query = useQuery({
    queryKey: ['approval-tasks'],
    queryFn: () => listApprovalTasks(accessToken!, ''),
    enabled: !!accessToken && !!canRead,
  });

  if (!canRead) {
    return (
      <p className="py-20 text-center text-[13px] text-text-muted">
        No approval:task:read permission.
      </p>
    );
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      setSuccess(`${label} completed.`);
      await queryClient.invalidateQueries({ queryKey: ['approval-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    }
  }

  const allTasks = query.data?.data ?? [];
  const pending = allTasks.filter((t) => t.status === 'PENDING');
  const breachingSla = pending.filter((t) => isBreachingSla(t.createdAt));
  const decidedToday = allTasks.filter((t) => t.decision && wasDecidedToday(t.decision.decidedAt));
  const approvedToday = decidedToday.filter((t) => t.decision?.decision === 'APPROVED');
  const rejectedToday = decidedToday.filter((t) => t.decision?.decision === 'REJECTED');
  const decidedWithDuration = allTasks.filter((t) => t.decision);
  const medianDecisionMinutes = (() => {
    if (decidedWithDuration.length === 0) return null;
    const durations = decidedWithDuration
      .map((t) => (new Date(t.decision!.decidedAt).getTime() - new Date(t.createdAt).getTime()) / 60_000)
      .sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2);
    return durations.length % 2 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2;
  })();

  const activityCounts = new Map<string, number>();
  for (const t of pending) {
    activityCounts.set(t.entityType, (activityCounts.get(t.entityType) ?? 0) + 1);
  }

  const tasks = [...pending]
    .filter((t) => activityFilter === 'ALL' || t.entityType === activityFilter)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="-m-6 flex flex-col p-[26px_34px_34px]">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1.5">LFB back office · merchant operations</p>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">
            Maker-checker queue
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            Signed in as {user?.email ?? '—'}
          </p>
        </div>
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

      <div className="mb-5 grid grid-cols-4 gap-[14px]">
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="text-[12.5px] text-text-muted">Awaiting decision</p>
          <p className="mt-[10px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
            {pending.length}
          </p>
          <p className="mt-1 text-[12px] text-text-muted">
            across {activityCounts.size} activity type{activityCounts.size === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-[14px] border border-warning-border bg-warning-bg p-[18px]">
          <p className="text-[12.5px] text-text-muted">Breaching SLA</p>
          <p className="mt-[10px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-warning-text">
            {breachingSla.length}
          </p>
          <p className="mt-1 text-[12px] text-text-muted">4-hour onboarding SLA</p>
        </div>
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="text-[12.5px] text-text-muted">Decided today</p>
          <p className="mt-[10px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
            {decidedToday.length}
          </p>
          <p className="mt-1 text-[12px] text-text-muted">
            {approvedToday.length} approved · {rejectedToday.length} rejected
          </p>
        </div>
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="text-[12.5px] text-text-muted">Median decision time</p>
          <p className="mt-[10px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
            {medianDecisionMinutes === null ? '—' : `${Math.round(medianDecisionMinutes)}m`}
          </p>
          <p className="mt-1 text-[12px] text-text-muted">from submission</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setActivityFilter('ALL')}
          className={
            activityFilter === 'ALL'
              ? 'rounded-[20px] bg-button-primary px-[13px] py-[6px] text-[12.5px] font-medium text-white'
              : 'rounded-[20px] border border-border-default bg-surface px-[13px] py-[6px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]'
          }
        >
          All {pending.length}
        </button>
        {[...activityCounts.entries()].map(([type, count]) => (
          <button
            key={type}
            onClick={() => setActivityFilter(type)}
            className={
              activityFilter === type
                ? 'rounded-[20px] bg-button-primary px-[13px] py-[6px] text-[12.5px] font-medium text-white'
                : 'rounded-[20px] border border-border-default bg-surface px-[13px] py-[6px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]'
            }
          >
            {activityLabel(type)} {count}
          </button>
        ))}
      </div>

      <div className="rounded-[14px] border border-border-default bg-surface">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-y border-border-hairline text-[12px] font-medium text-text-muted">
              <th className="px-5 py-3 text-left font-medium">Entity</th>
              <th className="px-2 py-3 text-left font-medium">Activity</th>
              <th className="px-2 py-3 text-left font-medium">Stage</th>
              <th className="px-2 py-3 text-left font-medium">Waiting</th>
              <th className="px-5 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-text-muted">
                  Loading approval tasks…
                </td>
              </tr>
            ) : query.isError ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-danger-text">
                  Failed to load approval tasks. Please try refreshing.
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-text-muted">
                  No pending approval tasks.
                </td>
              </tr>
            ) : (
              tasks.map((task, i) => (
                <ApprovalTaskRow
                  key={task.id}
                  task={task}
                  token={accessToken!}
                  currentUserId={user?.sub ?? ''}
                  canApprove={!!canApprove}
                  canReject={!!canReject}
                  isLast={i === tasks.length - 1}
                  onApprove={(notes) => run('Approve', () => approveTask(accessToken!, task.id, notes))}
                  onReject={(notes) => run('Reject', () => rejectTask(accessToken!, task.id, notes))}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApprovalTaskRow({
  task,
  token,
  currentUserId,
  canApprove,
  canReject,
  isLast,
  onApprove,
  onReject,
}: {
  task: ApprovalTask;
  token: string;
  currentUserId: string;
  canApprove: boolean;
  canReject: boolean;
  isLast: boolean;
  onApprove: (notes?: string) => void;
  onReject: (notes: string) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const isMerchantStatusChange = task.entityType === 'MERCHANT_STATUS_CHANGE';
  const isOnboarding = ['MERCHANT_ONBOARDING', 'SCHOOL_ONBOARDING'].includes(task.entityType);
  const isDisputeRefund = task.entityType === 'DISPUTE_REFUND';
  const isMaker = task.makerId === currentUserId;

  const merchantQuery = useQuery({
    queryKey: ['approval-task-merchant', task.entityId],
    queryFn: () => getMerchant(token, task.entityId),
    enabled: isMerchantStatusChange,
  });
  const onboardingQuery = useQuery({
    queryKey: ['approval-task-onboarding', task.entityId],
    queryFn: () => getOnboardingApplication(token, task.entityId),
    enabled: isOnboarding,
  });
  const disputeQuery = useQuery({
    queryKey: ['approval-task-dispute', task.entityId],
    queryFn: () => getDispute(token, task.entityId),
    enabled: isDisputeRefund,
  });

  const merchant = merchantQuery.data;
  const onboardingApp = onboardingQuery.data;
  const dispute = disputeQuery.data;

  const viewHref = isMerchantStatusChange
    ? `/merchants/${task.entityId}`
    : isDisputeRefund
      ? `/disputes/${task.entityId}`
      : `/onboarding/${task.entityId}`;

  const entityCell =
    isMerchantStatusChange && merchant ? (
      <span>
        <span className="font-medium text-text-primary">{merchant.tradingName}</span>
        {merchant.pendingStatusAction && (
          <span className="text-text-muted">
            {' '}
            — {merchant.pendingStatusAction}
            {merchant.pendingStatusReason ? `: ${merchant.pendingStatusReason}` : ''}
          </span>
        )}
      </span>
    ) : isOnboarding && onboardingApp ? (
      <span>
        <span className="font-medium text-text-primary">{onboardingApp.merchant.tradingName}</span>
        <span className="text-text-muted"> · {onboardingApp.applicationNo}</span>
      </span>
    ) : isDisputeRefund && dispute ? (
      <span>
        <span className="font-mono text-[12px] text-text-muted">{dispute.caseNo}</span>
        <span className="text-text-muted"> · {formatCurrency(Number(dispute.disputedAmount), dispute.currency)}</span>
      </span>
    ) : (
      <span className="font-mono text-text-muted">{task.entityId.slice(0, 8)}…</span>
    );

  const stageCell =
    isMerchantStatusChange && merchant?.pendingStatusAction ? (
      <span>{merchant.pendingStatusAction.replace(/_/g, ' ')}</span>
    ) : isOnboarding && onboardingApp ? (
      <span>{formatOnboardingStep(onboardingApp.currentStep ?? onboardingApp.status)}</span>
    ) : isDisputeRefund && dispute ? (
      <span>{DISPUTE_STAGE_LABELS[dispute.stage]}</span>
    ) : (
      <span className="text-text-muted">—</span>
    );

  const entityName =
    (isMerchantStatusChange && merchant?.tradingName) ||
    (isOnboarding && onboardingApp?.merchant.tradingName) ||
    (isDisputeRefund && dispute?.caseNo) ||
    task.entityId.slice(0, 8);

  async function handleRejectConfirm(params: { remarks: string }) {
    setModalLoading(true);
    onReject(params.remarks);
    setModalLoading(false);
    setShowReject(false);
  }

  async function handleApproveConfirm(comment?: string) {
    setModalLoading(true);
    onApprove(comment);
    setModalLoading(false);
    setShowConfirm(false);
  }

  const waiting = waitingSince(task.createdAt);
  const waitingBreached = waiting.endsWith('h') && parseInt(waiting) >= 4 || waiting.endsWith('d');

  return (
    <>
      <tr className={isLast ? '' : 'border-b border-border-row'}>
        <td className="px-5 py-3">{entityCell}</td>
        <td className="px-2 py-3 text-text-body">{activityLabel(task.entityType)}</td>
        <td className="px-2 py-3 text-text-body">{stageCell}</td>
        <td className="px-2 py-3">
          <span
            className={`font-medium tabular-nums ${waitingBreached ? 'text-danger-text' : 'text-text-muted'}`}
          >
            {waitingBreached ? `Breached ${waiting}` : `${waiting} left`}
          </span>
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center justify-end gap-2">
            {isMaker && <span className="text-[12px] text-text-muted">You submitted this</span>}
            <Link href={viewHref} className="text-[12.5px] text-accent-link hover:text-accent-link-hover">
              View
            </Link>
            {canApprove && !isMaker && (
              <button
                onClick={() => setShowConfirm(true)}
                className="rounded-[8px] bg-button-primary px-3 py-[6px] text-[12.5px] font-medium text-white hover:bg-button-primary-hover"
              >
                Approve
              </button>
            )}
            {canReject && !isMaker && (
              <button
                onClick={() => setShowReject(true)}
                className="rounded-[8px] border border-danger px-3 py-[6px] text-[12.5px] font-medium text-danger-text hover:bg-danger-bg"
              >
                Reject
              </button>
            )}
          </div>
        </td>
      </tr>

      <RejectModal
        open={showReject}
        title="Reject Task"
        description={`Rejecting the approval task for ${entityName}. Provide your reason so the maker can understand the decision.`}
        remarksLabel="Rejection reason"
        onClose={() => setShowReject(false)}
        onConfirm={handleRejectConfirm}
        loading={modalLoading}
      />

      <ConfirmModal
        open={showConfirm}
        title="Approve Task"
        description={`Approving the maker-checker task for ${entityName}. This decision is recorded and cannot be undone.`}
        confirmLabel="Approve"
        commentLabel="Comment (optional)"
        onClose={() => setShowConfirm(false)}
        onConfirm={handleApproveConfirm}
        loading={modalLoading}
      />
    </>
  );
}
