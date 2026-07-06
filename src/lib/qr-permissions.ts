import type { JwtClaims } from '@/lib/auth-api';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ACQUIRER_ADMIN', 'BANK_ADMIN'];

export function canViewQr(user: JwtClaims | null): boolean {
  return Boolean(user?.permissions?.includes('qr:read'));
}

export function canCreateQr(user: JwtClaims | null): boolean {
  return Boolean(user?.permissions?.includes('qr:generate'));
}

export function canRegenerateQr(user: JwtClaims | null): boolean {
  return canCreateQr(user);
}

export function canDisableQr(user: JwtClaims | null): boolean {
  return canCreateQr(user);
}

export function canDownloadQr(user: JwtClaims | null): boolean {
  return canViewQr(user);
}

export function canRevealInternalId(user: JwtClaims | null): boolean {
  return Boolean(user?.roles?.some((r) => ADMIN_ROLES.includes(r)));
}

export function isQrGenerationBlocked(merchantStatus: string): boolean {
  return !['ACTIVE'].includes(merchantStatus);
}

export function qrSummaryLabel(
  merchantStatus: string,
  summary?: { active: number; total: number } | null,
  loading?: boolean,
): string {
  if (loading) return '…';
  if (isQrGenerationBlocked(merchantStatus)) {
    return merchantStatus === 'SUSPENDED' || merchantStatus === 'REJECTED'
      ? 'Blocked'
      : 'Not available';
  }
  if (!summary || summary.total === 0) return 'No QR issued';
  return `${summary.active} active`;
}
