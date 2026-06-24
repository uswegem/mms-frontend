'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ChevronDown,
  LogOut,
  Search,
  Settings,
  User,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export function TopBar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/merchants?q=${encodeURIComponent(search.trim())}`);
    }
  }

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/95 px-6 backdrop-blur-sm">
      <Breadcrumbs />

      <div className="flex flex-1 items-center justify-end gap-3">
        {/* Global search */}
        <form onSubmit={handleSearch} className="relative hidden max-w-sm flex-1 md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search merchants, transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </form>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative" title="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* User menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium leading-none">{user?.email}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {user?.roles?.[0] ?? 'User'}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card py-1 shadow-[var(--shadow-lg)]">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-medium">{user?.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {user?.roles?.map((r) => (
                      <Badge key={r} variant="primary" className="text-[10px]">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted"
                  onClick={() => { setMenuOpen(false); router.push('/dashboard'); }}
                >
                  <User className="h-4 w-4" /> Profile
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted"
                  onClick={() => { setMenuOpen(false); router.push('/configuration'); }}
                >
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <Separator />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted"
                  onClick={() => { setMenuOpen(false); void handleLogout(); }}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
