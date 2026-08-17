const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface ProblemDetails {
  code?: string;
  detail?: string;
  title?: string;
  [key: string]: unknown;
}

export class TransactionsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly problem?: ProblemDetails,
  ) {
    super(message);
    this.name = 'TransactionsApiError';
  }
}

async function parseError(res: Response): Promise<TransactionsApiError> {
  let problem: ProblemDetails | undefined;
  try {
    problem = (await res.json()) as ProblemDetails;
  } catch {
    problem = undefined;
  }
  return new TransactionsApiError(
    problem?.detail ?? problem?.title ?? `Request failed (${res.status})`,
    res.status,
    problem,
  );
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export interface Payment {
  id: string;
  merchantId: string;
  storeId: string | null;
  terminalId: string | null;
  tipsEndToEndId: string;
  amount: string;
  currency: string;
  status: 'INITIATED' | 'SUCCESS' | 'FAILED' | 'REVERSED' | 'DISPUTED' | 'REFUND_PENDING';
  channel: 'QR' | 'LIPA_NAMBA' | 'USSD' | 'API' | 'OTHER';
  payerMsisdnMasked: string | null;
  payerNameMasked: string | null;
  payerFsp: string | null;
  tipsSettledAt: string | null;
  receivedAt: string;
}

export interface PaginatedPayments {
  items: Payment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LedgerQuery {
  merchantId?: string;
  storeId?: string;
  status?: Payment['status'];
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listTransactions(token: string, query: LedgerQuery = {}): Promise<PaginatedPayments> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const res = await fetch(`${API_BASE}/transactions?${params}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function getTransaction(token: string, id: string): Promise<Payment> {
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

/**
 * Dev/UAT only — simulates TIPS calling our own webhook. There is no real
 * TIPS sandbox to trigger a payment from yet (per the platform's mocked
 * TipsPaymentProvider), so this is how the till screen demonstrates the
 * live confirmation flow end to end.
 */
export async function simulatePayment(input: {
  alias: string;
  amount: string;
  payerFsp?: string;
}): Promise<Payment> {
  const res = await fetch(`${API_BASE}/tips/webhook/payment-confirmation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      alias: input.alias,
      amount: input.amount,
      payerFsp: input.payerFsp ?? 'M-Pesa',
      payerMsisdnMasked: '0754 ••• 219',
      tipsEndToEndId: `TIPS-SIM-${Date.now()}`,
    }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}
