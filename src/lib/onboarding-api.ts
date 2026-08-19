const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface OnboardingApplication {
  id: string;
  applicationNo: string;
  legalEntityType: string;
  status: string;
  currentStep?: string | null;
  merchantId: string;
  merchant: {
    id: string;
    merchantCode?: string | null;
    legalName: string;
    tradingName: string;
    displayName?: string | null;
    status: string;
    mcc: string;
    businessCategory?: string | null;
    taxId?: string | null;
    vrn?: string | null;
    licenseNumber?: string | null;
    contactPerson?: string | null;
    relationshipManager?: string | null;
    branch?: string | null;
    sourceChannel?: string | null;
    isSchool: boolean;
    profile: {
      addressLine1?: string | null;
      addressLine2?: string | null;
      region?: string | null;
      district?: string | null;
      ward?: string | null;
      city: string;
      postalCode: string;
      contactPhone: string | null;
      contactEmail: string | null;
    } | null;
    settlementAccount: {
      id: string;
      accountNumber: string;
      accountName: string;
      bankCode: string;
      verifiedAt: string | null;
    } | null;
    documents?: Array<{
      id: string;
      docType: string;
      fileName: string;
      verificationStatus: string;
      rejectionReason?: string | null;
      createdAt: string;
    }>;
    alias?: { alias8digit: string } | null;
    stores?: Array<{
      id: string;
      storeName: string;
      storeCode: string;
      terminalId?: string | null;
      alias?: string | null;
      lipaNambaHandle?: string | null;
      qrString?: string | null;
      status: string;
    }>;
    settlementConfig?: {
      settlementAlias?: string | null;
      payoutCycle?: string | null;
      mdr?: string | null;
      charges?: string | null;
      transactionLimit?: string | null;
      dailyLimit?: string | null;
      approvalStatus: string;
      remarks?: string | null;
    } | null;
    integrations?: Array<{
      integrationType: string;
      externalReferenceId?: string | null;
      status: string;
      failureReason?: string | null;
      retryCount: number;
      lastTriedAt?: string | null;
    }>;
  };
  riskReview?: {
    riskScore?: number | null;
    riskLevel?: string | null;
    duplicateFlag: boolean;
    blacklistFlag: boolean;
    status: string;
    remarks?: string | null;
  } | null;
  steps: { stepCode: string; completedAt: string | null }[];
  beneficialOwners?: Array<{
    id: string;
    fullName: string;
    ownershipPct?: string | null;
    nidaVerifications: VerificationAttempt[];
  }>;
  traVerifications?: Array<VerificationAttempt & { tin: string }>;
  rejectionCode: string | null;
  rejectionNotes?: string | null;
  createdAt: string;
  activatedAt?: string | null;
}

/** Brief §4.3 — one row per NIDA/TRA verification attempt (append-only). */
export interface VerificationAttempt {
  id: string;
  result: 'MATCH' | 'MISMATCH' | 'NOT_FOUND' | 'PROVIDER_ERROR';
  verifiedName?: string | null;
  failureReason?: string | null;
  verifiedAt: string;
}

/**
 * Thrown by the shared `request()` helper. Carries the backend's
 * ProblemDetails `code`/`extra` fields (e.g. NIDA/TRA `result` + `source`)
 * so callers can render a specific outcome, not just a message string.
 */
export class OnboardingApiError extends Error {
  code?: string;
  result?: string;
  source?: string;
  constructor(message: string, opts?: { code?: string; result?: string; source?: string }) {
    super(message);
    this.name = 'OnboardingApiError';
    this.code = opts?.code;
    this.result = opts?.result;
    this.source = opts?.source;
  }
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
    throw new OnboardingApiError(
      problem.detail ?? problem.title ?? problem.message ?? `Request failed (${res.status})`,
      { code: problem.code, result: problem.result, source: problem.source },
    );
  }
  return res.json();
}

export function listOnboardingApplications(
  token: string,
  page = 1,
  status?: string,
  q?: string,
  limit = 20,
  onboardingType?: 'MERCHANT' | 'SCHOOL',
) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (onboardingType) params.set('onboardingType', onboardingType);
  return request<{ data: OnboardingApplication[]; meta: { total: number; page: number; limit: number } }>(
    `/onboarding/applications?${params}`,
    token,
  );
}

export function getOnboardingDashboard(token: string) {
  return request<{ counts: Record<string, number>; total: number }>(
    '/onboarding/applications/dashboard/stats',
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

export function deleteOnboardingDocument(token: string, id: string, documentId: string) {
  return request<OnboardingApplication>(
    `/merchant-onboarding/${id}/kyc/documents/${documentId}`,
    token,
    { method: 'DELETE' },
  );
}

/** Brief §4.3 Step 2 — register a beneficial owner ahead of NIDA verification. */
export function addBeneficialOwner(
  token: string,
  id: string,
  body: { fullName: string; idNumber: string; ownershipPct?: number },
) {
  return request<{ id: string; fullName: string }>(
    `/onboarding/applications/${id}/beneficial-owners`,
    token,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

/** Brief §4.3 Step 2 — verify a beneficial owner's national ID against NIDA. */
export function verifyBeneficialOwnerNida(token: string, id: string, ownerId: string) {
  return request<VerificationAttempt>(
    `/onboarding/applications/${id}/beneficial-owners/${ownerId}/verify-nida`,
    token,
    { method: 'POST' },
  );
}

/** Brief §4.3 Step 3 — verify the application's TIN against TRA. */
export function verifyTin(token: string, id: string) {
  return request<VerificationAttempt & { tin: string }>(
    `/onboarding/applications/${id}/verify-tin`,
    token,
    { method: 'POST' },
  );
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

/** Brief §4.3 Step 7 — fee schedule / MDR configuration. Decimal fields arrive as strings. */
export interface FeeScheduleCharge {
  id: string;
  chargeType: 'MDR' | 'SETTLEMENT_TRANSFER' | 'QR_POSTER_REPRINT' | 'DISPUTE_INVESTIGATION';
  basis: 'PERCENT_OF_TRANSACTION' | 'FLAT_PER_SWEEP' | 'FLAT_PER_ASSET' | 'FLAT_PER_CASE';
  rate: string | null;
  flatAmount: string | null;
  capAmount: string | null;
}

export interface FeeSchedule {
  id: string;
  version: number;
  scope: 'DEFAULT' | 'MCC' | 'MERCHANT';
  scopeKey: string | null;
  status: string;
  effectiveFrom: string | null;
  charges: FeeScheduleCharge[];
}

export interface ApplicationFeeSchedule {
  schedule: FeeSchedule;
  accepted: boolean;
  acceptedAt: string | null;
}

export function getApplicationFeeSchedule(token: string, id: string) {
  return request<ApplicationFeeSchedule>(`/onboarding/applications/${id}/fee-schedule`, token);
}

export function acceptFeeSchedule(token: string, id: string) {
  return request<{ scheduleId: string; version: number; acceptedAt: string }>(
    `/onboarding/applications/${id}/accept-fee-schedule`,
    token,
    { method: 'POST' },
  );
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

export function approveKyc(token: string, id: string, remarks?: string) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/kyc/approve`, token, {
    method: 'POST',
    body: JSON.stringify({ remarks }),
  });
}

export function approveRisk(
  token: string,
  id: string,
  body: { riskScore?: number; riskLevel?: string; remarks?: string },
) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/risk/approve`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function validateBank(token: string, id: string) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/bank/validate`, token, {
    method: 'POST',
  });
}

export function registerTips(token: string, id: string) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/tips/register`, token, {
    method: 'POST',
  });
}

export function retryTips(token: string, id: string) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/tips/retry`, token, {
    method: 'POST',
  });
}

/** @deprecated Use registerTips */
export const registerTps = registerTips;

/** @deprecated Use retryTips */
export const retryTps = retryTips;

export function registerAliasQr(token: string, id: string) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/alias-qr/register`, token, {
    method: 'POST',
  });
}

export function retryAliasQr(token: string, id: string) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/alias-qr/retry`, token, {
    method: 'POST',
  });
}

export function saveSettlement(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/settlement`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function submitSettlement(token: string, id: string) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/settlement`, token, {
    method: 'POST',
    body: JSON.stringify({ payoutCycle: 'DAILY' }),
  });
}

export function approveSettlement(token: string, id: string, remarks?: string) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/settlement/approve`, token, {
    method: 'POST',
    body: JSON.stringify({ remarks }),
  });
}

export function activateOnboarding(token: string, id: string) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/activate`, token, {
    method: 'POST',
  });
}

export function rejectKyc(token: string, id: string, remarks: string, rejectionCode = 'INCOMPLETE_KYC') {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/kyc/reject`, token, {
    method: 'POST',
    body: JSON.stringify({ remarks, rejectionCode }),
  });
}

export function sendBackOnboarding(token: string, id: string, remarks: string) {
  return request<OnboardingApplication>(`/merchant-onboarding/${id}/send-back`, token, {
    method: 'POST',
    body: JSON.stringify({ remarks }),
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

export function getOnboardingAuditLogs(token: string, id: string) {
  return request<Array<{
    id: string;
    action: string;
    oldStatus?: string | null;
    newStatus?: string | null;
    performedAt: string;
    remarks?: string | null;
  }>>(`/merchant-onboarding/${id}/audit-logs`, token);
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

export const ONBOARDING_WIZARD_STEPS = [
  { code: 'ENTITY_PROFILE', label: 'Merchant Profile' },
  { code: 'KYC_DOCUMENTS', label: 'KYC Documents' },
  { code: 'SETTLEMENT_ACCOUNT', label: 'Bank Account' },
  { code: 'RISK_REVIEW', label: 'Risk Review' },
  { code: 'TPS_REGISTRATION', label: 'TIPS Registration' },
  { code: 'ALIAS_QR_SETUP', label: 'Store / Alias / QR' },
  { code: 'SETTLEMENT_CONFIG', label: 'Settlement Config' },
  { code: 'FINAL_REVIEW', label: 'Review & Activate' },
] as const;

/** User-facing label for integration types stored in the database. */
export function integrationTypeLabel(integrationType: string): string {
  if (integrationType === 'TPS') return 'TIPS';
  return integrationType;
}

/** User-facing onboarding status (internal codes may still contain TPS). */
export function formatOnboardingStatus(status: string): string {
  return (
    DASHBOARD_STATUS_LABELS[status] ??
    status.replace(/TPS/g, 'TIPS').replace(/_/g, ' ')
  );
}

/** User-facing onboarding step label. */
export function formatOnboardingStep(stepCode: string): string {
  const known = ONBOARDING_WIZARD_STEPS.find((s) => s.code === stepCode);
  if (known) return known.label;
  return formatOnboardingStatus(stepCode);
}

/** User-facing audit action label. */
export function formatAuditAction(action: string): string {
  return action.replace(/tps/gi, 'TIPS').replace(/_/g, ' ');
}

export const DASHBOARD_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_KYC_DOCUMENTS: 'Pending KYC Docs',
  PENDING_KYC_APPROVAL: 'Pending KYC',
  UNDER_REVIEW: 'Under Review',
  PENDING_RISK_REVIEW: 'Pending Risk',
  PENDING_BANK_VALIDATION: 'Pending Bank',
  BANK_VALIDATION_FAILED: 'Bank Failed',
  PENDING_TPS_REGISTRATION: 'Pending TIPS',
  TPS_REGISTRATION_FAILED: 'TIPS Failed',
  TPS_REGISTERED: 'TIPS Registered',
  PENDING_ALIAS_QR_SETUP: 'Pending QR',
  ALIAS_QR_FAILED: 'QR Failed',
  PENDING_SETTLEMENT_SETUP: 'Pending Settlement',
  SETTLEMENT_APPROVAL_PENDING: 'Settlement Approval',
  READY_FOR_ACTIVATION: 'Ready',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  FAILED: 'Failed',
};
