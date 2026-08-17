const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface ProblemDetails {
  code?: string;
  detail?: string;
  title?: string;
  [key: string]: unknown;
}

export class SettlementsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly problem?: ProblemDetails,
  ) {
    super(message);
    this.name = 'SettlementsApiError';
  }
}

async function parseError(res: Response): Promise<SettlementsApiError> {
  let problem: ProblemDetails | undefined;
  try {
    problem = (await res.json()) as ProblemDetails;
  } catch {
    problem = undefined;
  }
  return new SettlementsApiError(
    problem?.detail ?? problem?.title ?? `Request failed (${res.status})`,
    res.status,
    problem,
  );
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export interface SettlementCycle {
  id: string;
  merchantId: string;
  cycleDate: string;
  status: 'PENDING' | 'SWEPT' | 'POSTED' | 'FAILED';
  transactionCount: number;
  grossAmount: string;
  mdrAmount: string;
  netAmount: string;
  cbsPostingRef: string | null;
  sweptAt: string | null;
  postedAt: string | null;
  failureReason: string | null;
}

export interface PaginatedCycles {
  items: SettlementCycle[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listSettlements(
  token: string,
  query: { merchantId?: string; status?: SettlementCycle['status']; page?: number; pageSize?: number } = {},
): Promise<PaginatedCycles> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const res = await fetch(`${API_BASE}/settlements?${params}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}
