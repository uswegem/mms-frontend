const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface PermissionCatalogItem {
  id: string;
  code: string;
  module: string;
  description?: string | null;
}

export interface RoleListItem {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleDetail extends RoleListItem {
  permissions: string[];
  assignedUserCount: number;
}

export interface EffectivePermissions {
  permissions: string[];
  rolePermissions: string[];
  allowedOverrides: string[];
  deniedPermissions: string[];
  roles: string[];
  storeIds: string[];
  terminalIds: string[];
}

export interface PolicyOverride {
  id: string;
  userId: string;
  permissionCode: string;
  effect: 'ALLOW' | 'DENY';
  scopeType?: string | null;
  scopeId?: string | null;
  reason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  user?: { id: string; email: string; fullName: string };
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers(token), ...init?.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { detail?: string }).detail ?? `Request failed (${res.status})`,
    );
  }
  return res.json();
}

export function listAuthzRoles(token: string) {
  return request<RoleListItem[]>('/authz/roles', token);
}

export function getAuthzRole(token: string, roleId: string) {
  return request<RoleDetail>(`/authz/roles/${roleId}`, token);
}

export function createAuthzRole(
  token: string,
  body: { code: string; name: string },
) {
  return request<RoleListItem>('/authz/roles', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateAuthzRole(
  token: string,
  roleId: string,
  body: { name: string },
) {
  return request<RoleListItem>(`/authz/roles/${roleId}`, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deleteAuthzRole(token: string, roleId: string) {
  return request<void>(`/authz/roles/${roleId}`, token, { method: 'DELETE' });
}

export function assignRolePermissions(
  token: string,
  roleId: string,
  permissionCodes: string[],
) {
  return request<RoleDetail>(`/authz/roles/${roleId}/permissions`, token, {
    method: 'PUT',
    body: JSON.stringify({ permissionCodes }),
  });
}

export function listPermissionCatalog(token: string) {
  return request<PermissionCatalogItem[]>('/authz/permissions', token);
}

export function getMyPermissions(token: string) {
  return request<EffectivePermissions>('/authz/me/permissions', token);
}

export function getUserEffectivePermissions(token: string, userId: string) {
  return request<EffectivePermissions>(
    `/authz/users/${userId}/effective-permissions`,
    token,
  );
}

export function listPolicyOverrides(token: string, userId?: string) {
  const q = userId ? `?userId=${userId}` : '';
  return request<PolicyOverride[]>(`/authz/policy-overrides${q}`, token);
}

export function createPolicyOverride(
  token: string,
  body: {
    userId: string;
    permissionCode: string;
    effect: 'ALLOW' | 'DENY';
    reason?: string;
    expiresAt?: string;
  },
) {
  return request<PolicyOverride>('/authz/policy-overrides', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function revokePolicyOverride(token: string, overrideId: string) {
  return request<PolicyOverride>(`/authz/policy-overrides/${overrideId}`, token, {
    method: 'DELETE',
  });
}
