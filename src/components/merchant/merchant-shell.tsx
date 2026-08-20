'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { AlertTriangle, GraduationCap, LayoutDashboard, Link2, LogOut, QrCode, Receipt, Scale, Wallet, Zap } from 'lucide-react';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { cn } from '@/lib/utils';
import { isMerchantScopedRoles } from '@/lib/permissions';
import { BrandLogo } from '@/components/layout/brand-logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/merchant/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/merchant/till', label: 'Take a payment', icon: Zap },
  { href: '/merchant/transactions', label: 'Transactions', icon: Receipt },
  { href: '/merchant/settlements', label: 'Settlement', icon: Wallet },
  { href: '/merchant/qr', label: 'QR Codes', icon: QrCode },
  { href: '/merchant/links', label: 'Payment Links', icon: Link2 },
  { href: '/merchant/disputes', label: 'Disputes', icon: AlertTriangle },
  { href: '/merchant/reconciliation', label: 'Reconciliation', icon: Scale },
  { href: '/merchant/school-dashboard', label: 'School Overview', icon: GraduationCap },
];

/**
 * Deliberately a separate, lightweight shell rather than reusing AppShell —
 * the merchant portal and the back-office console are meant to read as two
 * different surfaces sharing one login (design prototype's framing), not
 * one console with a different nav list bolted on.
 */
export function MerchantShell({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, user, logout } = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();

  // A back-office user (no merchant-level role) has no business in this
  // portal — send them to the console they actually have access to,
  // rather than showing a shell whose every API call will 403.
  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !isMerchantScopedRoles(user.roles)) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated || !user || !isMerchantScopedRoles(user.roles)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-background">
      <aside className="sticky top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <BrandLogo variant="sidebar" showTagline={false} />
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-accent text-[var(--brand-yellow)]'
                    : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-sidebar-muted hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 backdrop-blur-sm">
          <div className="text-sm text-muted-foreground">Merchant portal</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            {user.roles?.[0] && (
              <Badge variant="primary" className="text-[10px]">
                {user.roles[0]}
              </Badge>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
