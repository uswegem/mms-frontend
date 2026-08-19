const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface ApprovalTask {
  id: string;
  entityType: string;
  entityId: string;
  makerId: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  decision?: {
    checkerId: string;
    decision: string;
    notes: string | null;
    decidedAt: string;
  } | null;
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
    throw new Error(problem.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function listApprovalTasks(token: string, status = 'PENDING') {
  const params = new URLSearchParams({ page: '1', limit: '50' });
  if (status) params.set('status', status);
  return request<{ data: ApprovalTask[]; meta: { total: number } }>(
    `/approvals/tasks?${params}`,
    token,
  );
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

/** Handoff §cfgmc — only entity types with a real maker-checker gate wired into a workflow. */
export type ApprovalEntityType = 'MERCHANT_ONBOARDING' | 'SCHOOL_ONBOARDING' | 'MERCHANT_STATUS_CHANGE';

export interface ApprovalPolicy {
  entityType: ApprovalEntityType;
  enabled: boolean;
  slaHours: number;
  updatedAt: string | null;
}

export function listApprovalPolicies(token: string) {
  return request<ApprovalPolicy[]>('/approvals/policies', token);
}

export function updateApprovalPolicy(
  token: string,
  entityType: ApprovalEntityType,
  body: { enabled: boolean; slaHours: number },
) {
  return request<ApprovalPolicy>(`/approvals/policies/${entityType}`, token, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
