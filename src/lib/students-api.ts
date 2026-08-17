const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// ─── Types ───────────────────────────────────────────────────────────────────

export type StudentStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface StudentAlias {
  alias10digit: string;
  acquirerCode3: string;
  aliasSeq6: string;
  tipsRegistered: boolean;
  isActive: boolean;
  qrCodeId: string | null;
}

export interface Student {
  id: string;
  merchantId: string;
  admissionNo: string;
  fullName: string;
  guardianPhone: string | null;
  parentEmail: string | null;
  isActive: boolean;
  status: StudentStatus;
  studentAlias: StudentAlias | null;
}

export interface PreviewRow {
  row: number;
  admissionNo: string;
  fullName: string;
  guardianPhone?: string;
  parentEmail?: string;
  errors: string[];
  valid: boolean;
  isDuplicate?: boolean;
}

export interface BulkPreviewResult {
  total: number;
  valid: number;
  invalid: number;
  rows: PreviewRow[];
}

export interface BatchConfirmResult {
  batchId: string;
  total: number;
  queued: number;
  skipped: number;
}

// ─── Student list & single enrol ─────────────────────────────────────────────

export async function listStudents(
  token: string,
  merchantId: string,
): Promise<Student[]> {
  const res = await fetch(`${API_BASE}/schools/${merchantId}/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createStudent(
  token: string,
  merchantId: string,
  body: {
    admissionNo: string;
    fullName: string;
    guardianPhone?: string;
    parentEmail?: string;
  },
): Promise<{ student: Student; alias: StudentAlias }> {
  const res = await fetch(`${API_BASE}/schools/${merchantId}/students`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Two-step CSV bulk import ─────────────────────────────────────────────────

export async function bulkPreviewStudents(
  token: string,
  merchantId: string,
  file: File,
): Promise<BulkPreviewResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(
    `${API_BASE}/schools/${merchantId}/students/bulk/preview`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function bulkConfirmStudents(
  token: string,
  merchantId: string,
  rows: PreviewRow[],
): Promise<BatchConfirmResult> {
  const res = await fetch(`${API_BASE}/schools/${merchantId}/students/bulk`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── QR notifications ─────────────────────────────────────────────────────────

export async function sendQrToParent(
  token: string,
  merchantId: string,
  studentId: string,
  channels: ('email' | 'sms')[],
): Promise<{ emailQueued: boolean; smsQueued: boolean }> {
  const res = await fetch(
    `${API_BASE}/schools/${merchantId}/students/${studentId}/send-qr`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channels }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── QR payload fetch ─────────────────────────────────────────────────────────

export async function fetchStudentQrPayload(
  token: string,
  qrId: string,
): Promise<{ tlvPayload: string; version: number } | null> {
  const res = await fetch(`${API_BASE}/qr/${qrId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    payloadVersions?: Array<{ tlvPayload: string; version: number }>;
  };
  return data.payloadVersions?.[0] ?? null;
}
