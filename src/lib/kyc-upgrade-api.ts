const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class KycUpgradeApiError extends Error {}

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
    throw new KycUpgradeApiError(
      problem.detail ?? problem.title ?? problem.message ?? `Request failed (${res.status})`,
    );
  }
  return res.json();
}

export type KycTier = 'TIER_1' | 'TIER_2' | 'TIER_3';
export type KycUpgradeStatus = 'IN_PROGRESS' | 'PENDING_CHECKER_APPROVAL' | 'APPROVED' | 'REJECTED';
export type VerificationResult = 'MATCH' | 'MISMATCH' | 'NOT_FOUND' | 'PROVIDER_ERROR';

export interface KycUpgradeDocument {
  id: string;
  docType: string;
  fileName: string;
  uploadedAt: string;
}

export interface KycUpgradeRequest {
  id: string;
  acquirerId: string;
  merchantId: string;
  fromTier: KycTier;
  toTier: KycTier;
  status: KycUpgradeStatus;
  tin: string | null;
  tinVerificationResult: VerificationResult | null;
  tinVerifiedName: string | null;
  rejectionNotes: string | null;
  createdAt: string;
  documents: KycUpgradeDocument[];
}

export interface KycUpgradeStatusView {
  currentTier: KycTier;
  rollingVolume: number;
  tierThreshold: number;
  breached: boolean;
  activeRequest: KycUpgradeRequest | null;
}

export function getKycUpgradeStatus(token: string, merchantId?: string) {
  const params = merchantId ? `?merchantId=${merchantId}` : '';
  return request<KycUpgradeStatusView>(`/kyc-upgrades/status${params}`, token);
}

export function startKycUpgrade(token: string) {
  return request<KycUpgradeRequest>('/kyc-upgrades', token, { method: 'POST' });
}

export function getKycUpgradeRequest(token: string, id: string) {
  return request<KycUpgradeRequest>(`/kyc-upgrades/${id}`, token);
}

export function verifyKycUpgradeTin(token: string, id: string, tin: string) {
  return request<KycUpgradeRequest>(`/kyc-upgrades/${id}/verify-tin`, token, {
    method: 'POST',
    body: JSON.stringify({ tin }),
  });
}

export function addKycUpgradeDocument(
  token: string,
  id: string,
  body: { docType: string; fileName: string; s3Bucket: string; s3Key: string; mimeType?: string; fileSize?: number },
) {
  return request<KycUpgradeDocument>(`/kyc-upgrades/${id}/documents`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function uploadKycUpgradeDocumentFile(
  token: string,
  requestId: string,
  file: File,
  docType: string,
) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return addKycUpgradeDocument(token, requestId, {
    docType,
    fileName: safeName,
    s3Bucket: 'mms-dev',
    s3Key: `kyc-upgrade/${requestId}/${docType}/${Date.now()}-${safeName}`,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
  });
}

export function submitKycUpgrade(token: string, id: string) {
  return request<KycUpgradeRequest>(`/kyc-upgrades/${id}/submit`, token, { method: 'POST' });
}

export const KYC_UPGRADE_DOC_TYPES = [
  { code: 'BUSINESS_LICENSE', label: 'Business licence' },
  { code: 'BRELA_CERTIFICATE', label: 'BRELA certificate' },
  { code: 'TIN_CERTIFICATE', label: 'TIN certificate' },
] as const;
