'use client';

import { useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw, Search, XCircle } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  approveTask,
  listApprovalTasks,
  rejectTask,
  type ApprovalTask,
  type ApprovalTaskStatus,
} from '@/lib/approvals-api';
import {
  formatOnboardingStatus,
  getOnboardingApplication,
  listOnboardingApplications,
  makerApproveOnboarding,
  sendBackOnboarding,
  type OnboardingApplication,
} from '@/lib/onboarding-api';
import { formatDateTime } from '@/lib/format';
import { ApprovalDetailDrawer } from '@/components/approvals/approval-detail-drawer';

type StatusFilter = '' | ApprovalTaskStatus;
type SortKey = 'createdAt' | 'name' | 'status';

type EnrichedRow = {
  task: ApprovalTask;
  application: OnboardingApplication | null;
};

function merchantLabel(app: OnboardingApplication | null, task: ApprovalTask) {
  if (!app) return task.entityId.slice(0, 8) + '…';
  return app.merchant.tradingName || app.merchant.legalName || app.applicationNo;
}

export function MerchantApprovalPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [bulkNotes, setBulkNotes] = useState('');

  const canRead = user?.permissions?.includes('approval:task:read');
  const canApprove = user?.permissions?.includes('approval:task:approve');
  const canReject = user?.permissions?.includes('approval:task:reject');
  const canMakerApprove = user?.permissions?.includes('onboarding:approve');
  const canSendBack = user?.permissions?.includes('onboarding:reject');
  const canReadOnboarding = user?.permissions?.includes('onboarding:read');

  const token = accessToken!;

  const tasksQuery = useQuery({
    queryKey: ['approval-tasks', statusFilter],
    queryFn: () =>
      listApprovalTasks(token, {
        page: 1,
        limit: 100,
        status: statusFilter || undefined,
      }),
    enabled: !!accessToken && !!canRead,
  });

  const pendingStatsQuery = useQuery({
    queryKey: ['approval-tasks-stats', 'PENDING'],
    queryFn: () => listApprovalTasks(token, { page: 1, limit: 1, status: 'PENDING' }),
    enabled: !!accessToken && !!canRead,
  });
  const approvedStatsQuery = useQuery({
    queryKey: ['approval-tasks-stats', 'APPROVED'],
    queryFn: () => listApprovalTasks(token, { page: 1, limit: 1, status: 'APPROVED' }),
    enabled: !!accessToken && !!canRead,
  });
  const rejectedStatsQuery = useQuery({
    queryKey: ['approval-tasks-stats', 'REJECTED'],
    queryFn: () => listApprovalTasks(token, { page: 1, limit: 1, status: 'REJECTED' }),
    enabled: !!accessToken && !!canRead,
  });

  const makerQueueQuery = useQuery({
    queryKey: ['approval-maker-queue'],
    queryFn: () => listOnboardingApplications(token, 1, 'SUBMITTED', undefined, 50),
    enabled: !!accessToken && !!canReadOnboarding && !!canMakerApprove,
  });

  const tasks = tasksQuery.data?.data ?? [];

  const detailQueries = useQueries({
    queries: tasks.map((task) => ({
      queryKey: ['onboarding-for-approval', task.entityId],
      queryFn: () => getOnboardingApplication(token, task.entityId),
      enabled: !!accessToken && !!canRead && !!task.entityId,
      staleTime: 30_000,
      retry: 1,
    })),
  });

  const enriched: EnrichedRow[] = useMemo(
    () =>
      tasks.map((task, i) => ({
        task,
        application: detailQueries[i]?.data ?? null,
      })),
    [tasks, detailQueries],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = enriched;
    if (q) {
      rows = rows.filter(({ task, application }) => {
        const m = application?.merchant;
        const hay = [
          m?.tradingName,
          m?.legalName,
          m?.contactPerson,
          m?.profile?.contactEmail,
          m?.profile?.contactPhone,
          application?.applicationNo,
          task.entityType,
          task.status,
          task.entityId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const sorted = [...rows].sort((a, b) => {
      if (sortKey === 'name') {
        return merchantLabel(a.application, a.task).localeCompare(
          merchantLabel(b.application, b.task),
        );
      }
      if (sortKey === 'status') {
        return a.task.status.localeCompare(b.task.status);
      }
      return new Date(b.task.createdAt).getTime() - new Date(a.task.createdAt).getTime();
    });
    return sorted;
  }, [enriched, search, sortKey]);

  const activeRow = filtered.find((r) => r.task.id === activeTaskId) ?? null;
  const activeDetailLoading =
    !!activeTaskId &&
    detailQueries[tasks.findIndex((t) => t.id === activeTaskId)]?.isLoading;

  const pendingCount = pendingStatsQuery.data?.meta?.total ?? enriched.filter((r) => r.task.status === 'PENDING').length;
  const approvedCount = approvedStatsQuery.data?.meta?.total ?? enriched.filter((r) => r.task.status === 'APPROVED').length;
  const rejectedCount = rejectedStatsQuery.data?.meta?.total ?? enriched.filter((r) => r.task.status === 'REJECTED').length;
  const makerQueue = makerQueueQuery.data?.data ?? [];

  async function refreshLists() {
    setSelectedIds(new Set());
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['approval-tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['approval-tasks-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['onboarding-for-approval'] }),
      queryClient.invalidateQueries({ queryKey: ['approval-maker-queue'] }),
      queryClient.invalidateQueries({ queryKey: ['onboarding'] }),
    ]);
  }

  async function runAction(label: string, fn: () => Promise<unknown>) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await fn();
      setSuccess(label);
      await refreshLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllPending() {
    const pendingIds = filtered.filter((r) => r.task.status === 'PENDING').map((r) => r.task.id);
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  }

  async function bulkApprove() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    await runAction(`Approved ${ids.length} merchant(s).`, async () => {
      const results = await Promise.allSettled(
        ids.map((id) => approveTask(token, id, bulkNotes.trim() || undefined)),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed) {
        throw new Error(`${failed} of ${ids.length} approvals failed. Refresh and retry remaining.`);
      }
    });
    setBulkNotes('');
  }

  async function bulkReject() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const notes = bulkNotes.trim() || 'Bulk rejected by checker';
    await runAction(`Rejected ${ids.length} merchant(s).`, async () => {
      const results = await Promise.allSettled(ids.map((id) => rejectTask(token, id, notes)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed) {
        throw new Error(`${failed} of ${ids.length} rejections failed. Refresh and retry remaining.`);
      }
    });
    setBulkNotes('');
  }

  if (!canRead) {
    return (
      <p className="py-20 text-center text-sm text-muted-foreground">
        You need <code className="font-mono">approval:task:read</code> permission to view merchant
        approvals.
      </p>
    );
  }

  const detailsLoading = detailQueries.some((q) => q.isLoading);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchant Approval"
        description="Review newly registered merchants, documents, and verification status — approve or reject from one place."
      >
        <Button
          variant="outline"
          size="sm"
          disabled={tasksQuery.isFetching || busy}
          onClick={() => void refreshLists()}
        >
          <RefreshCw className={`h-4 w-4 ${tasksQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pending" value={String(pendingCount)} subtitle="Awaiting checker decision" />
        <StatCard title="Approved" value={String(approvedCount)} subtitle="Checker-approved tasks" />
        <StatCard title="Rejected" value={String(rejectedCount)} subtitle="Checker-rejected tasks" />
        <StatCard
          title="Maker queue"
          value={String(makerQueue.length)}
          subtitle="Submitted, awaiting maker approve"
        />
      </div>

      {canMakerApprove && makerQueue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Awaiting Maker Approve</CardTitle>
            <CardDescription>
              Applications in SUBMITTED status. Maker Approve must be a different user from Checker
              Approve.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trading name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {makerQueue.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">
                      {app.merchant.tradingName || app.merchant.legalName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {app.merchant.contactPerson || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {app.merchant.profile?.contactEmail || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{app.merchant.isSchool ? 'School' : 'Retail'}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(app.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            `Maker approved ${app.merchant.tradingName || app.applicationNo}.`,
                            () => makerApproveOnboarding(token, app.id),
                          )
                        }
                      >
                        Maker Approve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Approval queue</CardTitle>
              <CardDescription>
                {filtered.length} of {tasks.length} task{tasks.length === 1 ? '' : 's'}
                {detailsLoading ? ' · loading merchant details…' : ''}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search business, owner, email, phone, application…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setSelectedIds(new Set());
              }}
              className="w-full lg:w-44"
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="">All statuses</option>
            </Select>
            <Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full lg:w-44"
            >
              <option value="createdAt">Sort: Newest</option>
              <option value="name">Sort: Name</option>
              <option value="status">Sort: Status</option>
            </Select>
          </div>

          {(canApprove || canReject) && selectedIds.size > 0 && (
            <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3 sm:flex-row sm:items-center">
              <p className="text-sm font-medium">{selectedIds.size} selected</p>
              <Input
                className="sm:max-w-xs"
                placeholder="Optional bulk notes…"
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
              />
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                {canApprove && (
                  <Button size="sm" disabled={busy} onClick={() => void bulkApprove()}>
                    <CheckCircle2 className="h-4 w-4" />
                    Bulk Approve
                  </Button>
                )}
                {canReject && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void bulkReject()}
                  >
                    <XCircle className="h-4 w-4" />
                    Bulk Reject
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {tasksQuery.isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading approvals…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    {(canApprove || canReject) && statusFilter !== 'APPROVED' && statusFilter !== 'REJECTED' ? (
                      <input
                        type="checkbox"
                        aria-label="Select all pending"
                        checked={
                          filtered.filter((r) => r.task.status === 'PENDING').length > 0 &&
                          filtered
                            .filter((r) => r.task.status === 'PENDING')
                            .every((r) => selectedIds.has(r.task.id))
                        }
                        onChange={toggleSelectAllPending}
                      />
                    ) : null}
                  </TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Email / Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      No merchants match this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(({ task, application }) => {
                    const merchant = application?.merchant;
                    const docs = merchant?.documents ?? [];
                    const suspended = merchant?.status === 'SUSPENDED';
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          {task.status === 'PENDING' && (canApprove || canReject) ? (
                            <input
                              type="checkbox"
                              aria-label={`Select ${merchantLabel(application, task)}`}
                              checked={selectedIds.has(task.id)}
                              onChange={() => toggleSelect(task.id)}
                            />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left font-medium text-primary hover:underline"
                            onClick={() => setActiveTaskId(task.id)}
                          >
                            {merchantLabel(application, task)}
                          </button>
                          {application?.applicationNo && (
                            <p className="text-xs text-muted-foreground">{application.applicationNo}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {merchant?.contactPerson || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="text-foreground">{merchant?.profile?.contactEmail || '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {merchant?.profile?.contactPhone || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {merchant?.isSchool ? 'School' : application?.legalEntityType || 'Retail'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={docs.length ? 'info' : 'outline'}>
                            {docs.length} doc{docs.length === 1 ? '' : 's'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {application ? (
                            <Badge variant={statusBadgeVariant(application.status)}>
                              {formatOnboardingStatus(application.status)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Loading…</Badge>
                          )}
                          {suspended && (
                            <div className="mt-1">
                              <Badge variant="danger">Suspended</Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(task.status)}>{task.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(application?.createdAt ?? task.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveTaskId(task.id)}
                            >
                              Review
                            </Button>
                            {task.status === 'PENDING' && canApprove && (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(
                                    `Approved ${merchantLabel(application, task)}.`,
                                    () => approveTask(token, task.id),
                                  )
                                }
                              >
                                Approve
                              </Button>
                            )}
                            {task.status === 'PENDING' && canReject && (
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(
                                    `Rejected ${merchantLabel(application, task)}.`,
                                    () => rejectTask(token, task.id, 'Rejected by checker'),
                                  )
                                }
                              >
                                Reject
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ApprovalDetailDrawer
        open={!!activeTaskId}
        task={activeRow?.task ?? null}
        application={activeRow?.application ?? null}
        loading={!!activeDetailLoading}
        busy={busy}
        canApprove={canApprove}
        canReject={canReject}
        canSendBack={canSendBack}
        onClose={() => setActiveTaskId(null)}
        onApprove={async (notes) => {
          if (!activeRow) return;
          await runAction(`Approved ${merchantLabel(activeRow.application, activeRow.task)}.`, () =>
            approveTask(token, activeRow.task.id, notes),
          );
          setActiveTaskId(null);
        }}
        onReject={async (notes) => {
          if (!activeRow) return;
          await runAction(`Rejected ${merchantLabel(activeRow.application, activeRow.task)}.`, () =>
            rejectTask(token, activeRow.task.id, notes),
          );
          setActiveTaskId(null);
        }}
        onRequestInfo={
          canSendBack
            ? async (notes) => {
                if (!activeRow?.application) return;
                await runAction('Requested additional information.', () =>
                  sendBackOnboarding(token, activeRow.application!.id, notes),
                );
                setActiveTaskId(null);
              }
            : undefined
        }
      />
    </div>
  );
}
