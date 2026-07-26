const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export type ApprovalTaskStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface ApprovalTask {
  id: string;
  acquirerId?: string;
  entityType: string;
  entityId: string;
  makerId: string;
  status: ApprovalTaskStatus | string;
  expiresAt: string | null;
  createdAt: string;
  decision?: {
    checkerId: string;
    decision: string;
    notes: string | null;
    decidedAt: string;
  } | null;
}

export interface ListApprovalTasksParams {
  page?: number;
  limit?: number;
  status?: ApprovalTaskStatus | '';
  entityType?: string;
}

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
    throw new Error(problem.detail ?? problem.title ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function listApprovalTasks(
  token: string,
  statusOrParams: ApprovalTaskStatus | ListApprovalTasksParams | '' = 'PENDING',
) {
  const params =
    typeof statusOrParams === 'string' || statusOrParams === ''
      ? { page: 1, limit: 50, status: statusOrParams || undefined }
      : statusOrParams;

  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 50),
  });
  if (params.status) qs.set('status', params.status);
  if (params.entityType) qs.set('entityType', params.entityType);

  return request<{ data: ApprovalTask[]; meta: { total: number; page?: number; limit?: number } }>(
    `/approvals/tasks?${qs}`,
    token,
  );
}

export function getApprovalTask(token: string, taskId: string) {
  return request<ApprovalTask>(`/approvals/tasks/${taskId}`, token);
}

export function approveTask(token: string, taskId: string, notes?: string) {
  return request<ApprovalTask>(`/approvals/tasks/${taskId}/approve`, token, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export function rejectTask(token: string, taskId: string, notes?: string) {
  return request<ApprovalTask>(`/approvals/tasks/${taskId}/reject`, token, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}
