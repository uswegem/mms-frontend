'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RejectModal } from '@/components/ui/reject-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { approveTask, listApprovalTasks, rejectTask, type ApprovalTask } from '@/lib/approvals-api';
import { getMerchant } from '@/lib/merchants-api';
import { formatOnboardingStep, getOnboardingApplication } from '@/lib/onboarding-api';

type StatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

/** Returns a compact relative-time string, e.g. "3d", "4h", "12m" */
function waitingSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function ApprovalsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');

  const canRead = user?.permissions?.includes('approval:task:read');
  const canApprove = user?.permissions?.includes('approval:task:approve');
  const canReject = user?.permissions?.includes('approval:task:reject');

  const query = useQuery({
    queryKey: ['approval-tasks', statusFilter],
    queryFn: () => listApprovalTasks(accessToken!, statusFilter === 'ALL' ? '' : statusFilter),
    enabled: !!accessToken && !!canRead,
  });

  if (!canRead) {
    return (
      <p className="py-20 text-center text-sm text-muted-foreground">
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

  // Sort oldest-first so long-pending items are visible at the top
  const tasks = [...(query.data?.data ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'ALL', label: 'All' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checker Inbox"
        description="Maker-checker approval tasks for merchant and school onboarding."
      />

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess(null)}>{success}</Alert>}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              {statusFilter === 'ALL' ? 'All' : statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()} Tasks
              {!query.isLoading && ` (${tasks.length})`}
            </CardTitle>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={{ width: 140 }}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Waiting</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading approval tasks…
                  </TableCell>
                </TableRow>
              ) : query.isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-[var(--destructive)]">
                    Failed to load approval tasks. Please try refreshing.
                  </TableCell>
                </TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No {statusFilter !== 'ALL' ? statusFilter.toLowerCase() + ' ' : ''}approval tasks.
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <ApprovalTaskRow
                    key={task.id}
                    task={task}
                    token={accessToken!}
                    currentUserId={user?.sub ?? ''}
                    canApprove={!!canApprove}
                    canReject={!!canReject}
                    onApprove={(notes) =>
                      run('Approve', () => approveTask(accessToken!, task.id, notes))
                    }
                    onReject={(notes) =>
                      run('Reject', () => rejectTask(accessToken!, task.id, notes))
                    }
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ApprovalTaskRow({
  task,
  token,
  currentUserId,
  canApprove,
  canReject,
  onApprove,
  onReject,
}: {
  task: ApprovalTask;
  token: string;
  currentUserId: string;
  canApprove: boolean;
  canReject: boolean;
  onApprove: (notes?: string) => void;
  onReject: (notes: string) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const isMerchantStatusChange = task.entityType === 'MERCHANT_STATUS_CHANGE';
  const isOnboarding = ['MERCHANT_ONBOARDING', 'SCHOOL_ONBOARDING'].includes(task.entityType);
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

  const merchant = merchantQuery.data;
  const onboardingApp = onboardingQuery.data;

  const viewHref = isMerchantStatusChange
    ? `/merchants/${task.entityId}`
    : `/onboarding/${task.entityId}`;

  // Entity name column
  const entityCell = isMerchantStatusChange && merchant ? (
    <span>
      <span className="font-medium">{merchant.tradingName}</span>
      {merchant.pendingStatusAction && (
        <span className="text-muted-foreground">
          {' '}— {merchant.pendingStatusAction}
          {merchant.pendingStatusReason ? `: ${merchant.pendingStatusReason}` : ''}
        </span>
      )}
    </span>
  ) : isOnboarding && onboardingApp ? (
    <span>
      <span className="font-medium">{onboardingApp.merchant.tradingName}</span>
      <span className="text-muted-foreground"> · {onboardingApp.applicationNo}</span>
    </span>
  ) : (
    <span className="font-mono text-muted-foreground">{task.entityId.slice(0, 8)}…</span>
  );

  // Stage column — what's pending right now
  const stageCell = isMerchantStatusChange && merchant?.pendingStatusAction ? (
    <span className="text-xs">{merchant.pendingStatusAction.replace(/_/g, ' ')}</span>
  ) : isOnboarding && onboardingApp ? (
    <span className="text-xs">
      {formatOnboardingStep(onboardingApp.currentStep ?? onboardingApp.status)}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  );

  // Confirm name for the approval dialog
  const entityName = (isMerchantStatusChange && merchant?.tradingName)
    || (isOnboarding && onboardingApp?.merchant.tradingName)
    || task.entityId.slice(0, 8);

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

  return (
    <>
      <TableRow>
        <TableCell className="text-xs">{entityCell}</TableCell>
        <TableCell className="text-xs">{task.entityType.replace(/_/g, ' ')}</TableCell>
        <TableCell>{stageCell}</TableCell>
        <TableCell>
          <span
            className={`text-xs font-medium tabular-nums ${
              waitingSince(task.createdAt).endsWith('d') &&
              parseInt(waitingSince(task.createdAt)) >= 3
                ? 'text-destructive'
                : 'text-muted-foreground'
            }`}
          >
            {waitingSince(task.createdAt)}
          </span>
        </TableCell>
        <TableCell>
          <Badge variant={statusBadgeVariant(task.status)}>{task.status}</Badge>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            {isMaker && (
              <span className="mr-2 text-xs text-muted-foreground">You submitted this</span>
            )}
            <Link href={viewHref}>
              <Button variant="ghost" size="sm">View</Button>
            </Link>
            {canApprove && !isMaker && (
              <Button size="sm" onClick={() => setShowConfirm(true)}>
                Approve
              </Button>
            )}
            {canReject && !isMaker && (
              <Button variant="destructive" size="sm" onClick={() => setShowReject(true)}>
                Reject
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>

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
