const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class FeeSchedulesApiError extends Error {}

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
    throw new FeeSchedulesApiError(
      problem.detail ?? problem.title ?? problem.message ?? `Request failed (${res.status})`,
    );
  }
  return res.json();
}

export type FeeScheduleScope = 'DEFAULT' | 'MCC' | 'MERCHANT';
export type FeeScheduleStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
export type FeeChargeType = 'MDR' | 'SETTLEMENT_TRANSFER' | 'QR_POSTER_REPRINT' | 'DISPUTE_INVESTIGATION';
export type FeeChargeBasis =
  | 'PERCENT_OF_TRANSACTION'
  | 'FLAT_PER_SWEEP'
  | 'FLAT_PER_ASSET'
  | 'FLAT_PER_CASE';

/** Decimal fields (rate/flatAmount/capAmount) arrive as strings over the wire. */
export interface FeeScheduleCharge {
  id: string;
  chargeType: FeeChargeType;
  basis: FeeChargeBasis;
  rate: string | null;
  flatAmount: string | null;
  capAmount: string | null;
}

export interface FeeSchedule {
  id: string;
  version: number;
  scope: FeeScheduleScope;
  scopeKey: string | null;
  status: FeeScheduleStatus;
  effectiveFrom: string | null;
  supersededAt: string | null;
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  charges: FeeScheduleCharge[];
}

export function listFeeSchedules(token: string) {
  return request<FeeSchedule[]>('/fee-schedules', token);
}

export interface CreateFeeScheduleChargeInput {
  chargeType: FeeChargeType;
  basis: FeeChargeBasis;
  rate?: number;
  flatAmount?: number;
  capAmount?: number;
}

export function createFeeSchedule(
  token: string,
  body: { scope: FeeScheduleScope; scopeKey?: string; charges: CreateFeeScheduleChargeInput[] },
) {
  return request<FeeSchedule>('/fee-schedules', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function activateFeeSchedule(token: string, id: string) {
  return request<FeeSchedule>(`/fee-schedules/${id}/activate`, token, { method: 'POST' });
}
