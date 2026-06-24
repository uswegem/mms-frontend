const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface OnboardingApplication {
  id: string;
  applicationNo: string;
  legalEntityType: string;
  status: string;
  merchantId: string;
  merchant: {
    legalName: string;
    tradingName: string;
    status: string;
    mcc: string;
    isSchool: boolean;
    profile: {
      city: string;
      postalCode: string;
      contactPhone: string | null;
      contactEmail: string | null;
    } | null;
    settlementAccount: {
      accountNumber: string;
      accountName: string;
      bankCode: string;
      verifiedAt: string | null;
    } | null;
  };
  steps: { stepCode: string; completedAt: string | null }[];
  rejectionCode: string | null;
  createdAt: string;
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

export function listOnboardingApplications(
  token: string,
  page = 1,
  status?: string,
  q?: string,
) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  return request<{ data: OnboardingApplication[]; meta: { total: number } }>(
    `/onboarding/applications?${params}`,
    token,
  );
}

export function getOnboardingApplication(token: string, id: string) {
  return request<OnboardingApplication>(`/onboarding/applications/${id}`, token);
}

export function createOnboardingApplication(
  token: string,
  body: Record<string, unknown>,
) {
  return request<OnboardingApplication>('/onboarding/applications', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateOnboardingApplication(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  return request<OnboardingApplication>(`/onboarding/applications/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function addOnboardingDocument(
  token: string,
  id: string,
  body: {
    docType: string;
    fileName: string;
    s3Bucket: string;
    s3Key: string;
    mimeType?: string;
    fileSize?: number;
  },
) {
  return request(`/onboarding/applications/${id}/documents`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function assignSettlementAccount(
  token: string,
  id: string,
  body: { accountNumber: string; accountName: string; bankCode: string },
) {
  return request(`/onboarding/applications/${id}/settlement-account`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function verifySettlement(token: string, id: string) {
  return request(`/onboarding/applications/${id}/verify-settlement`, token, {
    method: 'POST',
  });
}

export function submitOnboarding(token: string, id: string) {
  return request<OnboardingApplication>(`/onboarding/applications/${id}/submit`, token, {
    method: 'POST',
  });
}

export function makerApproveOnboarding(token: string, id: string) {
  return request<OnboardingApplication>(`/onboarding/applications/${id}/approve`, token, {
    method: 'POST',
  });
}

export function rejectOnboarding(
  token: string,
  id: string,
  rejectionCode: string,
  notes?: string,
) {
  return request<OnboardingApplication>(`/onboarding/applications/${id}/reject`, token, {
    method: 'POST',
    body: JSON.stringify({ rejectionCode, notes }),
  });
}

export function resubmitOnboarding(token: string, id: string) {
  return request<OnboardingApplication>(`/onboarding/applications/${id}/resubmit`, token, {
    method: 'POST',
  });
}

export function getOnboardingTimeline(token: string, id: string) {
  return request<{ events: { type: string; at: string; notes?: string }[] }>(
    `/onboarding/applications/${id}/timeline`,
    token,
  );
}

export async function uploadOnboardingKycFile(
  token: string,
  applicationId: string,
  file: File,
  docType: string,
) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return addOnboardingDocument(token, applicationId, {
    docType,
    fileName: safeName,
    s3Bucket: 'mms-dev',
    s3Key: `onboarding/${applicationId}/${docType}/${Date.now()}-${safeName}`,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
  });
}
