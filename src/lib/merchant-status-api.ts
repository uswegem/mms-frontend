import type { Merchant } from './merchants-api';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export type StatusAction =
  | 'SUBMIT_FOR_REVIEW'
  | 'MOVE_TO_PENDING_APPROVAL'
  | 'APPROVE'
  | 'REJECT'
  | 'SUSPEND'
  | 'REACTIVATE'
  | 'MARK_DORMANT'
  | 'CLOSE';

export interface StatusHistoryEntry {
  id: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  actorId: string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AllowedActions {
  merchantId: string;
  currentStatus: string;
  allowedActions: StatusAction[];
}

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw new Error(problem.detail ?? problem.title ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function getAllowedStatusActions(token: string, merchantId: string) {
  return request<AllowedActions>(
    `/merchants/${merchantId}/status/allowed-actions`,
    token,
  );
}

export function getStatusHistory(token: string, merchantId: string) {
  return request<StatusHistoryEntry[]>(
    `/merchants/${merchantId}/status/history`,
    token,
  );
}

function statusPost(token: string, merchantId: string, action: string, body?: object) {
  return request<Merchant>(`/merchants/${merchantId}/status/${action}`, token, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export const submitForReview = (token: string, id: string, notes?: string) =>
  statusPost(token, id, 'submit-review', { notes });

export const moveToPendingApproval = (token: string, id: string, notes?: string) =>
  statusPost(token, id, 'pending-approval', { notes });

export const approveMerchantStatus = (token: string, id: string, notes?: string) =>
  statusPost(token, id, 'approve', { notes });

export const rejectMerchantStatus = (
  token: string,
  id: string,
  reason?: string,
  notes?: string,
) => statusPost(token, id, 'reject', { reason, notes });

export type RequestableStatusAction = 'SUSPEND' | 'REACTIVATE' | 'MARK_DORMANT' | 'CLOSE';

export interface RequestStatusChangeInput {
  action: RequestableStatusAction;
  reason: string;
  notes?: string;
}

/**
 * Requests a status change instead of applying it — creates a maker-checker
 * approval task. The actual transition only happens once a different user
 * approves it via the Checker Inbox (/approvals).
 */
export const requestStatusChange = (
  token: string,
  id: string,
  body: RequestStatusChangeInput,
) => statusPost(token, id, 'request', body);

export const STATUS_ACTION_LABELS: Record<StatusAction, string> = {
  SUBMIT_FOR_REVIEW: 'Submit for Review',
  MOVE_TO_PENDING_APPROVAL: 'Move to Pending Approval',
  APPROVE: 'Approve (Checker)',
  REJECT: 'Reject',
  SUSPEND: 'Suspend',
  REACTIVATE: 'Reactivate',
  MARK_DORMANT: 'Mark Dormant',
  CLOSE: 'Close Merchant',
};
