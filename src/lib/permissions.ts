import { NAV_SECTIONS } from '@/lib/navigation';

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
