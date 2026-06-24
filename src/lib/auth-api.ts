const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface ProblemDetails {
  code?: string;
  detail?: string;
  title?: string;
  mfaRequired?: boolean;
  [key: string]: unknown;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly problem?: ProblemDetails,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }

  get mfaRequired(): boolean {
    const extra = this.problem?.extra as { mfaRequired?: boolean } | undefined;
    return (
      this.problem?.mfaRequired === true ||
      extra?.mfaRequired === true ||
      this.problem?.code === 'MMS-AUTH-003'
    );
  }
}

async function parseError(res: Response): Promise<AuthApiError> {
  let problem: ProblemDetails | undefined;
  try {
    problem = (await res.json()) as ProblemDetails;
  } catch {
    problem = undefined;
  }
  return new AuthApiError(
    problem?.detail ?? problem?.title ?? `Request failed (${res.status})`,
    res.status,
    problem,
  );
}

export async function login(
  email: string,
  password: string,
  mfaCode?: string,
): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, ...(mfaCode ? { mfaCode } : {}) }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function logout(accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
}

export async function refreshSession(): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export interface JwtClaims {
  sub: string;
  email: string;
  acquirerId: string;
  merchantId?: string;
  roles: string[];
  permissions: string[];
  exp: number;
  iat: number;
}

export function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}
