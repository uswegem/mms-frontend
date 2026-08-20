const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class ReconciliationApiError extends Error {}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
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
    throw new ReconciliationApiError(
      problem.detail ?? problem.title ?? problem.message ?? `Request failed (${res.status})`,
    );
  }
  return res.json();
}

export type ReconciliationExceptionType =
  | 'UNMATCHED_IN_REPORT'
  | 'UNMATCHED_IN_LEDGER'
  | 'DUPLICATE_REFERENCE';

export type ReconciliationExceptionStatus = 'OPEN' | 'RESOLVED' | 'WRITTEN_OFF';

export interface ReconciliationException {
  id: string;
  merchantId: string;
  cycleDate: string;
  type: ReconciliationExceptionType;
  tipsEndToEndId: string | null;
  amount: string | null;
  status: ReconciliationExceptionStatus;
  resolutionNotes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedExceptions {
  items: ReconciliationException[];
  total: number;
  page: number;
  pageSize: number;
}

export function listReconciliationExceptions(
  token: string,
  query: {
    merchantId?: string;
    status?: ReconciliationExceptionStatus;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  return request<PaginatedExceptions>(`/reconciliation/exceptions?${params}`, token);
}

export function getReconciliationException(token: string, id: string) {
  return request<ReconciliationException>(`/reconciliation/exceptions/${id}`, token);
}

export function resolveReconciliationException(
  token: string,
  id: string,
  body: { status: 'RESOLVED' | 'WRITTEN_OFF'; notes?: string },
) {
  return request<ReconciliationException>(`/reconciliation/exceptions/${id}/resolve`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function runReconciliationMatch(
  token: string,
  body: { merchantId: string; cycleDate: string },
) {
  return request<{ merchantId: string; cycleDate: string; matched: number; exceptions: number }>(
    '/reconciliation/run',
    token,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export const RECON_TYPE_LABELS: Record<ReconciliationExceptionType, string> = {
  UNMATCHED_IN_REPORT: 'In TIPS report, not in ledger',
  UNMATCHED_IN_LEDGER: 'In ledger, not in TIPS report',
  DUPLICATE_REFERENCE: 'Duplicate reference',
};

export const RECON_STATUS_LABELS: Record<ReconciliationExceptionStatus, string> = {
  OPEN: 'Open',
  RESOLVED: 'Resolved',
  WRITTEN_OFF: 'Written off',
};
