const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

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
    const problem = await res.json().catch(() => ({} as Record<string, unknown>));
    const message =
      (typeof problem.detail === 'string' && problem.detail) ||
      (typeof problem.message === 'string' && problem.message) ||
      (typeof problem.title === 'string' && problem.title) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json();
}

type IdName = { id: string; name: string };
export interface AcademicYear extends IdName {
  startsOn?: string | null; endsOn?: string | null; isCurrent?: boolean;
}
export interface AcademicTerm extends IdName {
  academicYearId: string; sequence?: number; startsOn?: string | null; endsOn?: string | null;
}
export interface ClassLevel extends IdName {
  code: string; sortOrder?: number; isActive?: boolean;
}
export interface FeeItem {
  id?: string; code: string; name: string; amount: string | number; isMandatory?: boolean; dueDate?: string; sortOrder?: number;
}
export interface FeeStructure extends IdName {
  academicYearId: string; academicTermId: string; classLevelId: string; status: string; items: FeeItem[];
}
export interface RegistryStudent {
  id: string; admissionNo: string; fullName: string; guardianName?: string | null;
  guardianPhone?: string | null; status: string;
  studentAlias?: { alias8digit?: string | null } | null;
  enrollments?: Array<{ academicYearId: string; classLevelId: string; classLevel?: ClassLevel; academicYear?: AcademicYear }>;
}
export interface FeePaymentRecord {
  id: string;
  amount: string | number;
  paymentReference?: string;
  gatewayTxnRef?: string;
  channel?: string;
  status?: string;
  paidAt?: string | null;
  createdAt?: string;
}
export interface FeeAdjustment {
  id: string;
  type: string;
  reason: string;
  amountOff: string | number;
  percentOff?: string | number | null;
}
export interface FeeInvoice {
  id: string;
  invoiceNumber?: string;
  paymentReference?: string;
  status: string;
  currency?: string;
  subtotalAmount?: string | number;
  adjustmentAmount?: string | number;
  totalAmount?: string | number;
  amountPaid?: string | number;
  outstandingBalance?: string | number;
  dueDate?: string | null;
  student?: Pick<RegistryStudent, 'id' | 'admissionNo' | 'fullName'>;
  academicTerm?: AcademicTerm;
  classLevel?: ClassLevel;
  lines?: FeeItem[];
  payments?: FeePaymentRecord[];
  adjustments?: FeeAdjustment[];
}
export interface InvoiceTotals {
  invoiceCount?: number;
  collected: string | number;
  outstanding: string | number;
  total: string | number;
}
export type FeePaymentChannel =
  | 'QR'
  | 'LIPA_NAMBA'
  | 'USSD'
  | 'BANK_BRANCH'
  | 'MOBILE_MONEY'
  | 'API'
  | 'OTHER';

export const PAYMENT_CHANNELS: Array<{ value: FeePaymentChannel; label: string }> = [
  { value: 'BANK_BRANCH', label: 'Bank / cash desk' },
  { value: 'MOBILE_MONEY', label: 'Mobile money' },
  { value: 'LIPA_NAMBA', label: 'Lipa Namba' },
  { value: 'QR', label: 'QR' },
  { value: 'USSD', label: 'USSD' },
  { value: 'API', label: 'API / transfer' },
  { value: 'OTHER', label: 'Other' },
];

export function moneyAmount(value: unknown): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function invoiceStatusLabel(status?: string): string {
  switch (status) {
    case 'UNPAID': return 'Unpaid';
    case 'PARTIALLY_PAID': return 'Partially Paid';
    case 'PAID': return 'Paid';
    case 'CANCELLED': return 'Cancelled';
    default: return status || '—';
  }
}

export function asAmount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isNaN(n) ? 0 : n;
}

export const listAcademicYears = (token: string, merchantId: string) =>
  request<AcademicYear[]>(`/schools/${merchantId}/academic-years`, token);
export const createAcademicYear = (token: string, merchantId: string, body: Omit<AcademicYear, 'id'>) =>
  request<AcademicYear>(`/schools/${merchantId}/academic-years`, token, { method: 'POST', body: JSON.stringify(body) });
export const updateAcademicYear = (token: string, merchantId: string, id: string, body: Partial<Omit<AcademicYear, 'id'>>) =>
  request<AcademicYear>(`/schools/${merchantId}/academic-years/${id}`, token, { method: 'PATCH', body: JSON.stringify(body) });
export const listTerms = (token: string, merchantId: string) =>
  request<AcademicTerm[]>(`/schools/${merchantId}/terms`, token);
export const createTerm = (token: string, merchantId: string, body: Omit<AcademicTerm, 'id'>) =>
  request<AcademicTerm>(`/schools/${merchantId}/terms`, token, { method: 'POST', body: JSON.stringify(body) });
export const updateTerm = (token: string, merchantId: string, id: string, body: Partial<Omit<AcademicTerm, 'id'>>) =>
  request<AcademicTerm>(`/schools/${merchantId}/terms/${id}`, token, { method: 'PATCH', body: JSON.stringify(body) });
export const listClassLevels = (token: string, merchantId: string) =>
  request<ClassLevel[]>(`/schools/${merchantId}/class-levels`, token);
export const createClassLevel = (token: string, merchantId: string, body: Omit<ClassLevel, 'id'>) =>
  request<ClassLevel>(`/schools/${merchantId}/class-levels`, token, { method: 'POST', body: JSON.stringify(body) });
export const updateClassLevel = (token: string, merchantId: string, id: string, body: Partial<Omit<ClassLevel, 'id'>>) =>
  request<ClassLevel>(`/schools/${merchantId}/class-levels/${id}`, token, { method: 'PATCH', body: JSON.stringify(body) });

export const listFeeStructures = (token: string, merchantId: string) =>
  request<FeeStructure[]>(`/schools/${merchantId}/fee-structures`, token);
export const createFeeStructure = (token: string, merchantId: string, body: Omit<FeeStructure, 'id' | 'status'>) =>
  request<FeeStructure>(`/schools/${merchantId}/fee-structures`, token, { method: 'POST', body: JSON.stringify(body) });
export const updateFeeStructure = (token: string, merchantId: string, id: string, body: Pick<FeeStructure, 'name' | 'items'>) =>
  request<FeeStructure>(`/schools/${merchantId}/fee-structures/${id}`, token, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteFeeStructure = (token: string, merchantId: string, id: string) =>
  request<void>(`/schools/${merchantId}/fee-structures/${id}`, token, { method: 'DELETE' });
export const publishFeeStructure = (token: string, merchantId: string, id: string) =>
  request<FeeStructure>(`/schools/${merchantId}/fee-structures/${id}/publish`, token, { method: 'POST' });
export const archiveFeeStructure = (token: string, merchantId: string, id: string) =>
  request<FeeStructure>(`/schools/${merchantId}/fee-structures/${id}/archive`, token, { method: 'POST' });
export const amendFeeStructure = (token: string, merchantId: string, id: string) =>
  request<FeeStructure>(`/schools/${merchantId}/fee-structures/${id}/amend`, token, { method: 'POST' });

export const listRegistryStudents = (token: string, merchantId: string, filters: Record<string, string | undefined> = {}) => {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value) as string[][]);
  return request<RegistryStudent[]>(`/schools/${merchantId}/registry/students${params.size ? `?${params}` : ''}`, token);
};
export const updateRegistryStudent = (token: string, merchantId: string, studentId: string, body: Partial<RegistryStudent>) =>
  request<RegistryStudent>(`/schools/${merchantId}/registry/students/${studentId}`, token, { method: 'PATCH', body: JSON.stringify(body) });
export const enrollRegistryStudent = (token: string, merchantId: string, studentId: string, body: { academicYearId: string; classLevelId: string }) =>
  request<RegistryStudent>(`/schools/${merchantId}/registry/students/${studentId}/enroll`, token, { method: 'POST', body: JSON.stringify(body) });

export const listFeeInvoices = (token: string, merchantId: string, filters: Record<string, string | undefined> = {}) => {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value) as string[][]);
  return request<FeeInvoice[]>(`/schools/${merchantId}/fee-invoices${params.size ? `?${params}` : ''}`, token);
};
export const getFeeInvoice = (token: string, merchantId: string, id: string) =>
  request<FeeInvoice>(`/schools/${merchantId}/fee-invoices/${id}`, token);
export const generateFeeInvoice = (token: string, merchantId: string, body: { studentId: string; academicTermId: string }) =>
  request<FeeInvoice>(`/schools/${merchantId}/fee-invoices/generate`, token, { method: 'POST', body: JSON.stringify(body) });
export const generateClassFeeInvoices = (token: string, merchantId: string, body: { classLevelId: string; academicTermId: string }) =>
  request<{ generated?: number }>(`/schools/${merchantId}/fee-invoices/generate-class`, token, { method: 'POST', body: JSON.stringify(body) });
export const cancelFeeInvoice = (token: string, merchantId: string, id: string, reason: string) =>
  request<FeeInvoice>(`/schools/${merchantId}/fee-invoices/${id}/cancel`, token, { method: 'POST', body: JSON.stringify({ reason }) });
export const adjustFeeInvoice = (token: string, merchantId: string, id: string, body: { type: 'DISCOUNT' | 'WAIVER' | 'SCHOLARSHIP'; reason: string; amountOff?: string; percentOff?: string; invoiceLineId?: string }) =>
  request<FeeInvoice>(`/schools/${merchantId}/fee-invoices/${id}/adjustments`, token, { method: 'POST', body: JSON.stringify(body) });
export const getStudentStatement = (token: string, merchantId: string, studentId: string) =>
  request<FeeInvoice[]>(`/schools/${merchantId}/fee-invoices/students/${studentId}/statement`, token);
export const getClassTermTotals = (token: string, merchantId: string, classLevelId: string, termId: string) =>
  request<InvoiceTotals>(`/schools/${merchantId}/fee-invoices/totals/${classLevelId}/${termId}`, token);

export const lookupSchoolFeePayment = (token: string, reference: string) =>
  request<{
    reference: string;
    referenceType: string;
    status: string;
    schoolName: string;
    studentName: string;
    amountDue: string;
    currency: string;
    invoiceNumber?: string | null;
  }>('/school-fee-payments/lookup/' + encodeURIComponent(reference), token);

export const initiateSchoolFeePayment = (token: string, body: {
  paymentReference: string;
  amount: string;
  outcome?: 'success' | 'failure' | 'pending';
  channel?: FeePaymentChannel;
}) =>
  request<{ gatewayTxnRef?: string; outcome?: string }>('/school-fee-payments/mock/initiate', token, { method: 'POST', body: JSON.stringify(body) });

export const notifySchoolFeePayment = (token: string, body: {
  paymentReference: string;
  amount: string;
  gatewayTxnRef: string;
  outcome?: 'success' | 'failure' | 'pending';
  channel?: FeePaymentChannel;
}) =>
  request<{
    applied?: boolean;
    duplicate?: boolean;
    paymentId?: string;
    overpayment?: string;
    status?: string;
  }>('/school-fee-payments/mock/notify', token, { method: 'POST', body: JSON.stringify(body) });

export async function collectSchoolFeePayment(
  token: string,
  body: { paymentReference: string; amount: string; channel: FeePaymentChannel },
) {
  const initiated = await initiateSchoolFeePayment(token, {
    paymentReference: body.paymentReference,
    amount: body.amount,
    outcome: 'success',
    channel: body.channel,
  });
  if (!initiated.gatewayTxnRef) {
    throw new Error('Payment initiation did not return a transaction reference');
  }
  return notifySchoolFeePayment(token, {
    paymentReference: body.paymentReference,
    amount: body.amount,
    gatewayTxnRef: initiated.gatewayTxnRef,
    outcome: 'success',
    channel: body.channel,
  });
}

export async function downloadPaymentSlip(token: string, merchantId: string, invoiceId: string) {
  const res = await fetch(`${API_BASE}/schools/${merchantId}/fee-invoices/${invoiceId}/payment-slip.pdf`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({} as Record<string, unknown>));
    throw new Error(
      (typeof problem.detail === 'string' && problem.detail) ||
      (typeof problem.message === 'string' && problem.message) ||
      `Unable to download payment slip (${res.status})`,
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payment-slip-${invoiceId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
