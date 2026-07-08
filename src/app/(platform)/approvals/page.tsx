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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { approveTask, listApprovalTasks, rejectTask, type ApprovalTask } from '@/lib/approvals-api';
import { getMerchant } from '@/lib/merchants-api';
import { formatDateTime } from '@/lib/format';

export default function ApprovalsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canRead = user?.permissions?.includes('approval:task:read');
  const canApprove = user?.permissions?.includes('approval:task:approve');
  const canReject = user?.permissions?.includes('approval:task:reject');

  const query = useQuery({
    queryKey: ['approval-tasks'],
    queryFn: () => listApprovalTasks(accessToken!, 'PENDING'),
    enabled: !!accessToken && !!canRead,
  });

  if (!canRead) {
    return <p className="py-20 text-center text-sm text-muted-foreground">No approval:task:read permission.</p>;
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

  const tasks = query.data?.data ?? [];

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
          <CardTitle className="text-base">Pending Approvals ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Loading approval tasks…
                  </TableCell>
                </TableRow>
              ) : query.isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-[var(--destructive)]">
                    Failed to load approval tasks. Please try refreshing.
                  </TableCell>
                </TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No pending approval tasks.
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <ApprovalTaskRow
                    key={task.id}
                    task={task}
                    token={accessToken!}
                    canApprove={!!canApprove}
                    canReject={!!canReject}
                    onApprove={() => run('Approve', () => approveTask(accessToken!, task.id))}
                    onReject={() =>
                      run('Reject', () => rejectTask(accessToken!, task.id, 'Rejected by checker'))
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
  canApprove,
  canReject,
  onApprove,
  onReject,
}: {
  task: ApprovalTask;
  token: string;
  canApprove: boolean;
  canReject: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isMerchantStatusChange = task.entityType === 'MERCHANT_STATUS_CHANGE';
  const merchantQuery = useQuery({
    queryKey: ['approval-task-merchant', task.entityId],
    queryFn: () => getMerchant(token, task.entityId),
    enabled: isMerchantStatusChange,
  });
  const merchant = merchantQuery.data;

  const viewHref = isMerchantStatusChange
    ? `/merchants/${task.entityId}`
    : `/onboarding/${task.entityId}`;

  return (
    <TableRow>
      <TableCell className="text-xs">
        {isMerchantStatusChange ? (
          merchant ? (
            <span>
              <span className="font-medium">{merchant.tradingName}</span>
              {merchant.pendingStatusAction && (
                <span className="text-muted-foreground">
                  {' '}
                  — {merchant.pendingStatusAction}
                  {merchant.pendingStatusReason ? `: ${merchant.pendingStatusReason}` : ''}
                </span>
              )}
            </span>
          ) : (
            <span className="font-mono">{task.entityId.slice(0, 8)}…</span>
          )
        ) : (
          <span className="font-mono">{task.entityId.slice(0, 8)}…</span>
        )}
      </TableCell>
      <TableCell>{task.entityType.replace(/_/g, ' ')}</TableCell>
      <TableCell>
        <Badge variant={statusBadgeVariant(task.status)}>{task.status}</Badge>
      </TableCell>
      <TableCell className="text-xs">{formatDateTime(task.createdAt)}</TableCell>
      <TableCell className="text-right space-x-1">
        <Link href={viewHref}>
          <Button variant="ghost" size="sm">View</Button>
        </Link>
        {canApprove && (
          <Button size="sm" onClick={onApprove}>
            Approve
          </Button>
        )}
        {canReject && (
          <Button variant="destructive" size="sm" onClick={onReject}>
            Reject
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
