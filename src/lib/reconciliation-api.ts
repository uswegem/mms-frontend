const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw new Error(problem.detail ?? problem.message ?? problem.title ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function listSchoolPaymentLedger(
  token: string,
  merchantId: string,
  params: Record<string, string | undefined> = {},
) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) q.set(k, v);
  });
  return request<{ data: unknown[]; total?: number; page?: number } | unknown[]>(
    `/schools/${merchantId}/payment-ledger?${q}`,
    token,
  );
}

export function getPaymentLedgerDetail(token: string, merchantId: string, paymentId: string) {
  return request(`/schools/${merchantId}/payment-ledger/${paymentId}`, token);
}

export function reversePayment(token: string, merchantId: string, paymentId: string, reason: string) {
  return request(`/schools/${merchantId}/payment-ledger/${paymentId}/reverse`, token, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function paymentDailySummary(token: string, merchantId: string, date: string) {
  return request(`/schools/${merchantId}/payment-ledger/daily-summary?date=${encodeURIComponent(date)}`, token);
}

export function listReconciliationRuns(token: string) {
  return request<unknown[]>('/reconciliation/runs', token);
}

export function getReconciliationRun(token: string, id: string) {
  return request(`/reconciliation/runs/${id}`, token);
}

export function startReconciliationRun(
  token: string,
  body: {
    source?: 'TIPS' | 'CBS';
    dateFrom: string;
    dateTo: string;
    dateWindowDays?: number;
    softDateVarianceDays?: number;
    hardDateVarianceDays?: number;
    threeWay?: boolean;
  },
) {
  return request('/reconciliation/runs', token, { method: 'POST', body: JSON.stringify(body) });
}

export function ingestSettlementCsv(token: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return request('/reconciliation/ingest', token, { method: 'POST', body: form, headers: {} });
}

export function generateSimFeed(
  token: string,
  body: { dateFrom?: string; dateTo?: string; source?: 'TIPS' | 'CBS'; threeWay?: boolean } = {},
) {
  return request('/reconciliation/sim-feed', token, { method: 'POST', body: JSON.stringify(body) });
}

export function schoolReconSummary(
  token: string,
  merchantId: string,
  dateFrom: string,
  dateTo: string,
) {
  return request(
    `/reconciliation/schools/${merchantId}/summary?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`,
    token,
  );
}

export function listReconExceptions(
  token: string,
  params: Record<string, string | undefined> = {},
) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) q.set(k, v);
  });
  return request<{ data: unknown[]; total?: number }>(`/reconciliation/exceptions?${q}`, token);
}

export function getReconException(token: string, id: string) {
  return request(`/reconciliation/exceptions/${id}`, token);
}

export function resolveReconException(
  token: string,
  id: string,
  body: {
    action: string;
    note?: string;
    payload?: Record<string, string | undefined>;
  },
) {
  return request(`/reconciliation/exceptions/${id}/resolve`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
