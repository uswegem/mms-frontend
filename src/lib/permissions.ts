import { NAV_SECTIONS } from '@/lib/navigation';

/** Mirrors the backend's MERCHANT_LEVEL_ROLES (system-role.enum.ts) — kept
 * in sync by hand since there's no shared package between the two repos. */
const MERCHANT_LEVEL_ROLES = ['MERCHANT_ADMIN', 'MERCHANT_USER', 'SCHOOL_ADMIN'];

/** True for a role set that lands in the merchant portal, not the back office. */
export function isMerchantScopedRoles(roles: string[] | undefined): boolean {
  return (roles ?? []).some((r) => MERCHANT_LEVEL_ROLES.includes(r));
}

export function postLoginRedirect(roles: string[] | undefined): string {
  return isMerchantScopedRoles(roles) ? '/merchant/dashboard' : '/dashboard';
}

export function hasPermission(
  permissions: string[] | undefined,
  required: string | string[],
): boolean {
  if (!permissions?.length) return false;
  const needed = Array.isArray(required) ? required : [required];
  return needed.every((p) => permissions.includes(p));
}

export function hasAnyPermission(
  permissions: string[] | undefined,
  required: string[],
): boolean {
  if (!permissions?.length) return false;
  return required.some((p) => permissions.includes(p));
}

/** Route → required permission(s). Undefined = authenticated users only. */
export function getRoutePermission(pathname: string): string | string[] | undefined {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item.permission;
      }
    }
  }

  if (pathname.startsWith('/onboarding/')) return 'onboarding:read';
  if (pathname.startsWith('/merchants/')) return 'merchant:read';
  if (pathname === '/dashboard' || pathname === '/') return undefined;

  return undefined;
}

export function canAccessRoute(
  pathname: string,
  permissions: string[] | undefined,
): boolean {
  const required = getRoutePermission(pathname);
  if (!required) return true;
  return hasPermission(permissions, required);
}
