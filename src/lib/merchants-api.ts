const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface ProblemDetails {
  code?: string;
  detail?: string;
  title?: string;
  [key: string]: unknown;
}

export class MerchantsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly problem?: ProblemDetails,
  ) {
    super(message);
    this.name = 'MerchantsApiError';
  }
}

async function parseError(res: Response): Promise<MerchantsApiError> {
  let problem: ProblemDetails | undefined;
  try {
    problem = (await res.json()) as ProblemDetails;
  } catch {
    problem = undefined;
  }
  return new MerchantsApiError(
    problem?.detail ?? problem?.title ?? `Request failed (${res.status})`,
    res.status,
    problem,
  );
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export interface MerchantProfile {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  countryCode: string;
  contactPhone: string | null;
  contactEmail: string | null;
}

export interface MerchantKyc {
  status: string;
  submittedAt: string | null;
}

export interface Merchant {
  id: string;
  acquirerId: string;
  legalName: string;
  tradingName: string;
  status: string;
  mcc: string;
  taxId: string | null;
  isSchool: boolean;
  onboardedAt: string | null;
  profile: MerchantProfile | null;
  kyc: MerchantKyc | null;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantDocument {
  id: string;
  docType: string;
  fileName: string;
  mimeType: string | null;
  fileSize: string | null;
  createdAt: string;
}

export interface MerchantKycReview {
  id: string;
  reviewerId: string;
  decision: string;
  notes: string | null;
  reviewedAt: string;
}

export type KycDocumentType = 'KYC_ID' | 'KYC_LICENSE' | 'KYC_TIN';

export interface CreateMerchantInput {
  legalName: string;
  tradingName: string;
  mcc: string;
  city: string;
  postalCode: string;
  taxId?: string;
  isSchool?: boolean;
  addressLine1?: string;
  addressLine2?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface UpdateMerchantInput {
  tradingName?: string;
  mcc?: string;
  city?: string;
  postalCode?: string;
  taxId?: string;
  addressLine1?: string;
  addressLine2?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface PaginatedMerchants {
  data: Merchant[];
  meta: { page: number; limit: number; total: number };
}

export async function listMerchants(
  token: string,
  page = 1,
  limit = 20,
  q?: string,
  status?: string,
): Promise<PaginatedMerchants> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (q) params.set('q', q);
  if (status) params.set('status', status);

  const res = await fetch(`${API_BASE}/merchants?${params}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function getMerchant(
  token: string,
  id: string,
): Promise<Merchant> {
  const res = await fetch(`${API_BASE}/merchants/${id}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function createMerchant(
  token: string,
  body: CreateMerchantInput,
): Promise<Merchant> {
  const res = await fetch(`${API_BASE}/merchants`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function updateMerchant(
  token: string,
  id: string,
  body: UpdateMerchantInput,
): Promise<Merchant> {
  const res = await fetch(`${API_BASE}/merchants/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function suspendMerchant(
  token: string,
  id: string,
): Promise<Merchant> {
  const res = await fetch(`${API_BASE}/merchants/${id}/suspend`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function activateMerchant(
  token: string,
  id: string,
): Promise<Merchant> {
  const res = await fetch(`${API_BASE}/merchants/${id}/activate`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function dormantMerchant(
  token: string,
  id: string,
): Promise<Merchant> {
  const res = await fetch(`${API_BASE}/merchants/${id}/dormant`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function addKycDocument(
  token: string,
  merchantId: string,
  body: {
    docType: string;
    fileName: string;
    s3Bucket: string;
    s3Key: string;
    mimeType?: string;
    fileSize?: number;
  },
): Promise<MerchantDocument> {
  const res = await fetch(`${API_BASE}/merchants/${merchantId}/kyc/documents`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function submitKyc(
  token: string,
  merchantId: string,
): Promise<Merchant> {
  const res = await fetch(`${API_BASE}/merchants/${merchantId}/kyc/submit`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function reviewKyc(
  token: string,
  merchantId: string,
  decision: 'APPROVED' | 'REJECTED' | 'MORE_INFO',
  notes?: string,
): Promise<Merchant> {
  const res = await fetch(`${API_BASE}/merchants/${merchantId}/kyc/review`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ decision, notes }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function listMerchantDocuments(
  token: string,
  merchantId: string,
): Promise<MerchantDocument[]> {
  const res = await fetch(`${API_BASE}/merchants/${merchantId}/documents`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function listKycReviews(
  token: string,
  merchantId: string,
): Promise<MerchantKycReview[]> {
  const res = await fetch(`${API_BASE}/merchants/${merchantId}/kyc/reviews`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

/** Register KYC document metadata from a local file (dev: stores path under mms-dev bucket). */
export async function uploadKycDocument(
  token: string,
  merchantId: string,
  file: File,
  docType: KycDocumentType,
): Promise<MerchantDocument> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return addKycDocument(token, merchantId, {
    docType,
    fileName: safeName,
    s3Bucket: 'mms-dev',
    s3Key: `kyc/${merchantId}/${docType}/${Date.now()}-${safeName}`,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
  });
}

export function exportMerchantsCsv(merchants: Merchant[]): void {
  const headers = [
    'Trading Name',
    'Legal Name',
    'MCC',
    'Status',
    'KYC Status',
    'Tax ID',
    'City',
    'Is School',
    'Created',
  ];
  const rows = merchants.map((m) => [
    m.tradingName,
    m.legalName,
    m.mcc,
    m.status,
    m.kyc?.status ?? 'PENDING',
    m.taxId ?? '',
    m.profile?.city ?? '',
    m.isSchool ? 'Yes' : 'No',
    m.createdAt,
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `merchants-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
