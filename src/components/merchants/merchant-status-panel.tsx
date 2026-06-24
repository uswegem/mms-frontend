'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MerchantStatusBadge } from '@/components/merchants/status-badge';
import { StatusTimeline } from '@/components/merchants/status-timeline';
import { StatusHistoryTable } from '@/components/merchants/status-history-table';
import { ChangeStatusModal } from '@/components/merchants/change-status-modal';
import { ApprovalModal } from '@/components/merchants/approval-modal';
import type { Merchant } from '@/lib/merchants-api';
import {
  approveMerchantStatus,
  closeMerchantStatus,
  dormantMerchantStatus,
  getAllowedStatusActions,
  getStatusHistory,
  moveToPendingApproval,
  rejectMerchantStatus,
  reactivateMerchantStatus,
  STATUS_ACTION_LABELS,
  submitForReview,
  suspendMerchantStatus,
  type StatusAction,
} from '@/lib/merchant-status-api';

const ACTION_HANDLERS: Record<
  StatusAction,
  (token: string, id: string, notes?: string, reason?: string) => Promise<unknown>
> = {
  SUBMIT_FOR_REVIEW: (t, id, n) => submitForReview(t, id, n),
  MOVE_TO_PENDING_APPROVAL: (t, id, n) => moveToPendingApproval(t, id, n),
  APPROVE: (t, id, n) => approveMerchantStatus(t, id, n),
  REJECT: (t, id, n, r) => rejectMerchantStatus(t, id, r, n),
  SUSPEND: (t, id, n) => suspendMerchantStatus(t, id, n),
  REACTIVATE: (t, id, n) => reactivateMerchantStatus(t, id, n),
  MARK_DORMANT: (t, id, n) => dormantMerchantStatus(t, id, n),
  CLOSE: (t, id, n) => closeMerchantStatus(t, id, n),
};

interface MerchantStatusPanelProps {
  merchant: Merchant;
  token: string;
  onUpdated: () => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function MerchantStatusPanel({
  merchant,
  token,
  onUpdated,
  onError,
  onSuccess,
}: MerchantStatusPanelProps) {
  const [modalAction, setModalAction] = useState<StatusAction | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const allowedQuery = useQuery({
    queryKey: ['status-actions', merchant.id],
    queryFn: () => getAllowedStatusActions(token, merchant.id),
    enabled: !!token,
  });

  const historyQuery = useQuery({
    queryKey: ['status-history', merchant.id],
    queryFn: () => getStatusHistory(token, merchant.id),
    enabled: !!token,
  });

  const allowed = allowedQuery.data?.allowedActions ?? [];

  async function executeAction(
    action: StatusAction,
    notes?: string,
    reason?: string,
  ) {
    setLoading(true);
    try {
      await ACTION_HANDLERS[action](token, merchant.id, notes, reason);
      onSuccess(`${STATUS_ACTION_LABELS[action]} completed.`);
      setModalAction(null);
      setApprovalOpen(false);
      await allowedQuery.refetch();
      await historyQuery.refetch();
      await onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Status change failed');
    } finally {
      setLoading(false);
    }
  }

  function openAction(action: StatusAction) {
    if (action === 'APPROVE') {
      setApprovalOpen(true);
    } else {
      setModalAction(action);
    }
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Management</CardTitle>
            <CardDescription className="flex items-center gap-2">
              Current:
              <MerchantStatusBadge status={merchant.status} />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {merchant.status === 'CLOSED' ? (
              <p className="text-sm text-muted-foreground">
                This merchant is closed and cannot be reactivated.
              </p>
            ) : allowed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No status actions available for your role.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allowed.map((action) => (
                  <Button
                    key={action}
                    variant={
                      action === 'REJECT' || action === 'CLOSE'
                        ? 'destructive'
                        : action === 'APPROVE'
                          ? 'default'
                          : 'outline'
                    }
                    size="sm"
                    onClick={() => openAction(action)}
                  >
                    {STATUS_ACTION_LABELS[action]}
                  </Button>
                ))}
              </div>
            )}
            <StatusTimeline
              history={historyQuery.data ?? []}
              currentStatus={merchant.status}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status History</CardTitle>
            <CardDescription>Immutable audit trail of all status changes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <StatusHistoryTable
              history={historyQuery.data ?? []}
              loading={historyQuery.isLoading}
            />
          </CardContent>
        </Card>
      </div>

      <ChangeStatusModal
        open={!!modalAction}
        action={modalAction}
        loading={loading}
        onClose={() => setModalAction(null)}
        onConfirm={(notes, reason) =>
          modalAction ? executeAction(modalAction, notes, reason) : Promise.resolve()
        }
      />

      <ApprovalModal
        open={approvalOpen}
        merchantName={merchant.tradingName}
        currentStatus={merchant.status}
        loading={loading}
        onClose={() => setApprovalOpen(false)}
        onApprove={(notes) => executeAction('APPROVE', notes)}
        onReject={(notes) => executeAction('REJECT', notes, 'POLICY_VIOLATION')}
      />
    </>
  );
}
