const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001/api/v1'
    : '/api/v1');

export interface ProblemDetails {
  code?: string;
  detail?: string;
  title?: string;
  [key: string]: unknown;
}

export class UsersApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly problem?: ProblemDetails,
  ) {
    super(message);
    this.name = 'UsersApiError';
  }
}

async function parseError(res: Response): Promise<UsersApiError> {
  let problem: ProblemDetails | undefined;
  try {
    problem = (await res.json()) as ProblemDetails;
  } catch {
    problem = undefined;
  }
  return new UsersApiError(
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

export interface UserRole {
  id: string;
  code: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  status: string;
  acquirerId: string;
  merchantId: string | null;
  phone: string | null;
  roles: UserRole[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedUsers {
  data: User[];
  meta: { page: number; limit: number; total: number };
}

export interface RoleListItem {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
}

export async function listUsers(
  token: string,
  page = 1,
  limit = 20,
): Promise<PaginatedUsers> {
  const res = await fetch(
    `${API_BASE}/users?page=${page}&limit=${limit}`,
    { headers: authHeaders(token), cache: 'no-store' },
  );
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function listRoles(token: string): Promise<RoleListItem[]> {
  const res = await fetch(`${API_BASE}/authz/roles`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function createUser(
  token: string,
  body: {
    email: string;
    fullName: string;
    roleIds: string[];
    merchantId?: string;
    phone?: string;
    password?: string;
  },
): Promise<{
  user: User;
  emailSent?: boolean;
  temporaryPassword?: string;
  reactivated?: boolean;
}> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function inviteUser(
  token: string,
  body: { email: string; roleId: string; merchantId?: string },
): Promise<{ message: string; inviteToken?: string }> {
  const res = await fetch(`${API_BASE}/users/invite`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function deactivateUser(
  token: string,
  userId: string,
): Promise<User> {
  const res = await fetch(`${API_BASE}/users/${userId}/deactivate`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function assignRoles(
  token: string,
  userId: string,
  roleIds: string[],
): Promise<User> {
  const res = await fetch(`${API_BASE}/users/${userId}/roles`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ roleIds }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}
