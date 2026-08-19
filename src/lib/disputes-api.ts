const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class DisputesApiError extends Error {}

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
    throw new DisputesApiError(
      problem.detail ?? problem.title ?? problem.message ?? `Request failed (${res.status})`,
    );
  }
  return res.json();
}

export type DisputeReason =
  | 'DUPLICATE_PAYMENT'
  | 'GOODS_NOT_RECEIVED'
  | 'INCORRECT_AMOUNT'
  | 'UNRECOGNIZED_TRANSACTION'
  | 'OTHER';

export type DisputeRaisedBy = 'MERCHANT' | 'PAYER' | 'LFB_OPS';

export type DisputeStage =
  | 'INVESTIGATION'
  | 'EVIDENCE_REQUESTED'
  | 'REFUND_PENDING_CHECKER'
  | 'RESOLVED_REFUNDED'
  | 'RESOLVED_NO_REFUND'
  | 'REJECTED';

export interface DisputeEvidence {
  id: string;
  fileName: string;
  s3Bucket: string;
  s3Key: string;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: string;
  uploadedBy: string;
}

/** Nested payment as returned by the disputes API — a subset of transactions-api's Payment. */
export interface DisputePayment {
  id: string;
  merchantId: string;
  tipsEndToEndId: string;
  amount: string;
  currency: string;
  status: string;
  channel: string;
  payerMsisdnMasked: string | null;
  payerNameMasked: string | null;
  payerFsp: string | null;
  receivedAt: string;
}

export interface Dispute {
  id: string;
  acquirerId: string;
  caseNo: string;
  merchantId: string;
  paymentId: string;
  raisedBy: DisputeRaisedBy;
  reason: DisputeReason;
  description: string;
  disputedAmount: string;
  currency: string;
  stage: DisputeStage;
  slaHours: number;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  payment: DisputePayment;
  evidence: DisputeEvidence[];
}

export function listDisputes(
  token: string,
  query: { merchantId?: string; stage?: DisputeStage; page?: number; limit?: number } = {},
) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  return request<{ items: Dispute[]; total: number }>(`/disputes?${params}`, token);
}

export function getDispute(token: string, id: string) {
  return request<Dispute>(`/disputes/${id}`, token);
}

export interface DisputeAuditLog {
  id: string;
  action: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Real per-action history — every audit.record() call the backend service makes. */
export function getDisputeAuditLogs(token: string, id: string) {
  return request<DisputeAuditLog[]>(`/disputes/${id}/audit-logs`, token);
}

export function createDispute(
  token: string,
  body: {
    merchantId: string;
    paymentId: string;
    raisedBy: DisputeRaisedBy;
    reason: DisputeReason;
    description: string;
    disputedAmount: number;
  },
) {
  return request<Dispute>('/disputes', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function addDisputeEvidence(
  token: string,
  id: string,
  body: { fileName: string; s3Bucket: string; s3Key: string; mimeType?: string; fileSize?: number },
) {
  return request<DisputeEvidence>(`/disputes/${id}/evidence`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Dev/UAT only — mirrors onboarding's uploadOnboardingKycFile pattern (no real object store yet). */
export async function uploadDisputeEvidenceFile(token: string, disputeId: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return addDisputeEvidence(token, disputeId, {
    fileName: safeName,
    s3Bucket: 'mms-dev',
    s3Key: `disputes/${disputeId}/${Date.now()}-${safeName}`,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
  });
}

export function requestDisputeEvidence(token: string, id: string) {
  return request<Dispute>(`/disputes/${id}/request-evidence`, token, { method: 'POST' });
}

/** Maker action — sends the refund to the checker queue via /approvals. */
export function initiateDisputeRefund(token: string, id: string) {
  return request<Dispute>(`/disputes/${id}/initiate-refund`, token, { method: 'POST' });
}

export function resolveDisputeWithoutRefund(token: string, id: string, notes: string) {
  return request<Dispute>(`/disputes/${id}/resolve-no-refund`, token, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  DUPLICATE_PAYMENT: 'Paid twice for one basket',
  GOODS_NOT_RECEIVED: 'Goods or service not received',
  INCORRECT_AMOUNT: 'Wrong amount entered at till',
  UNRECOGNIZED_TRANSACTION: 'Unrecognised debit',
  OTHER: 'Other',
};

export const DISPUTE_STAGE_LABELS: Record<DisputeStage, string> = {
  INVESTIGATION: 'Investigation',
  EVIDENCE_REQUESTED: 'Evidence requested',
  REFUND_PENDING_CHECKER: 'Refund pending checker',
  RESOLVED_REFUNDED: 'Resolved — refunded',
  RESOLVED_NO_REFUND: 'Resolved — no refund',
  REJECTED: 'Refund rejected',
};

export function isDisputeTerminal(stage: DisputeStage): boolean {
  return stage === 'RESOLVED_REFUNDED' || stage === 'RESOLVED_NO_REFUND' || stage === 'REJECTED';
}

/** SLA deadline is createdAt + slaHours; open disputes only (terminal-stage cases show no timer). */
export function disputeSlaDeadline(dispute: Dispute): Date {
  return new Date(new Date(dispute.createdAt).getTime() + dispute.slaHours * 3_600_000);
}
