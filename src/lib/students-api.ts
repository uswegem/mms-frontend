const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001/api/v1'
    : '/api/v1');

export interface StudentAlias {
  alias8digit: string;
  internalId8digit: string;
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
  isActive: boolean;
  studentAlias: StudentAlias | null;
}

export interface BulkUploadResult {
  total: number;
  created: number;
  reactivated: number;
  errors: number;
  results: Array<{
    row: number;
    admissionNo: string;
    status: 'created' | 'reactivated' | 'error';
    message?: string;
    studentId?: string;
    lipaNamba?: string;
  }>;
}

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
  body: { admissionNo: string; fullName: string; guardianPhone?: string },
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

export async function bulkUploadStudents(
  token: string,
  merchantId: string,
  file: File,
): Promise<BulkUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/schools/${merchantId}/students/bulk`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
