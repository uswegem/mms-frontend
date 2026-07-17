import type {
  CreateDynamicQrRequest,
  GenerateStaticQrRequest,
  MerchantQrResponse,
  QrActionResult,
} from '@/types/merchant-qr';
import { refreshSession } from '@/lib/auth-api';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

const TOKEN_KEY = 'mms_access_token';

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseError(res: Response): Promise<Error> {
  try {
    const body = (await res.json()) as { detail?: string; title?: string };
    return new Error(body.detail ?? body.title ?? `Request failed (${res.status})`);
  } catch {
    return new Error(`Request failed (${res.status})`);
  }
}

/** One refresh+retry when the access token expired mid-session (JWT is 15m). */
async function fetchWithAuthRetry(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  if (res.status !== 401) return res;

  try {
    const refreshed = await refreshSession();
    sessionStorage.setItem(TOKEN_KEY, refreshed.accessToken);
    window.dispatchEvent(
      new CustomEvent('mms:token-refreshed', { detail: refreshed.accessToken }),
    );
    headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  } catch {
    // Fall through — caller receives the original 401.
  }
  return res;
}

export function resolveAssetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function fetchMerchantQrs(
  token: string,
  merchantId: string,
): Promise<MerchantQrResponse> {
  const res = await fetchWithAuthRetry(token, `/merchants/${merchantId}/qr`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function generateStaticQr(
  token: string,
  merchantId: string,
  body: GenerateStaticQrRequest,
): Promise<QrActionResult> {
  const res = await fetchWithAuthRetry(token, `/merchants/${merchantId}/qr/static`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function createDynamicQr(
  token: string,
  merchantId: string,
  body: CreateDynamicQrRequest,
): Promise<QrActionResult> {
  const res = await fetchWithAuthRetry(token, `/merchants/${merchantId}/qr/dynamic`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function regenerateQr(
  token: string,
  qrId: string,
): Promise<QrActionResult> {
  const res = await fetchWithAuthRetry(token, `/qr/${qrId}/regenerate`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function disableQr(token: string, qrId: string): Promise<void> {
  const res = await fetchWithAuthRetry(token, `/qr/${qrId}/disable`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseError(res);
}

export function qrDownloadUrl(qrId: string, format: 'png' | 'svg' | 'pdf'): string {
  return `${API_BASE}/qr/${qrId}/download?format=${format}`;
}
