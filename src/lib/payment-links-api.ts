const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class PaymentLinksApiError extends Error {}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw new PaymentLinksApiError(
      problem.detail ?? problem.title ?? problem.message ?? `Request failed (${res.status})`,
    );
  }
  return res.json();
}

export type PaymentLinkStatus = 'ACTIVE' | 'PAID' | 'CANCELLED';

export interface PaymentLinkPayment {
  id: string;
  tipsEndToEndId: string;
  amount: string;
  currency: string;
  status: string;
  payerFsp: string | null;
  payerMsisdnMasked: string | null;
  receivedAt: string;
}

export interface PaymentLink {
  id: string;
  acquirerId: string;
  merchantId: string;
  itemName: string;
  orderRef: string;
  description: string | null;
  amount: string;
  currency: string;
  slug: string;
  status: PaymentLinkStatus;
  expiresAt: string;
  paymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  payment: PaymentLinkPayment | null;
}

export interface PublicPaymentLink extends PaymentLink {
  merchant: {
    tradingName: string;
    displayName: string | null;
    merchantAlias: { alias8digit: string } | null;
  };
}

export function listPaymentLinks(
  token: string,
  query: { merchantId?: string; status?: PaymentLinkStatus } = {},
) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, value);
  });
  return request<PaymentLink[]>(`/payment-links?${params}`, token);
}

export function getPaymentLink(token: string, id: string) {
  return request<PaymentLink>(`/payment-links/${id}`, token);
}

export function createPaymentLink(
  token: string,
  body: {
    itemName: string;
    orderRef: string;
    description?: string;
    amount: number;
    expiresInHours?: number;
  },
) {
  return request<PaymentLink>('/payment-links', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function cancelPaymentLink(token: string, id: string) {
  return request<PaymentLink>(`/payment-links/${id}/cancel`, token, { method: 'POST' });
}

export function reissuePaymentLink(token: string, id: string) {
  return request<PaymentLink>(`/payment-links/${id}/reissue`, token, { method: 'POST' });
}

/** Public — no auth. Powers the buyer-facing pay page. */
export function getPublicPaymentLink(slug: string) {
  return request<PublicPaymentLink>(`/payment-links/public/${slug}`, null);
}

/**
 * Dev/UAT only — simulates TIPS calling our own webhook, same as the till's
 * simulatePayment. A real deployment would have the buyer pay via their own
 * bank/wallet app scanning the link's QR; there is no real TIPS sandbox to
 * trigger that from here yet.
 */
export async function payPublicLink(slug: string, link: PublicPaymentLink) {
  const alias = link.merchant.merchantAlias?.alias8digit;
  if (!alias) {
    throw new PaymentLinksApiError(
      'This merchant has no active Lipa Namba alias to receive payment against',
    );
  }
  const tipsEndToEndId = `LINK-${slug}-${Date.now()}`;
  const res = await fetch(`${API_BASE}/tips/webhook/payment-confirmation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      alias,
      amount: link.amount,
      tipsEndToEndId,
      payerFsp: 'M-Pesa',
      payerMsisdnMasked: '0754 ••• 219',
    }),
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw new PaymentLinksApiError(problem.detail ?? `Payment failed (${res.status})`);
  }
  return confirmPublicPayment(slug, tipsEndToEndId);
}

export function confirmPublicPayment(slug: string, tipsEndToEndId: string) {
  return request<PublicPaymentLink>(`/payment-links/public/${slug}/confirm`, null, {
    method: 'POST',
    body: JSON.stringify({ tipsEndToEndId }),
  });
}

export function isLinkExpired(link: PaymentLink): boolean {
  return link.status === 'ACTIVE' && new Date(link.expiresAt) < new Date();
}

export function effectiveLinkStatus(link: PaymentLink): PaymentLinkStatus | 'EXPIRED' {
  return isLinkExpired(link) ? 'EXPIRED' : link.status;
}
