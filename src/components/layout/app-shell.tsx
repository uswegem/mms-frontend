'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { useRequireAuth } from '@/hooks/use-require-auth';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, user } = useRequireAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('mms_sidebar_collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  function toggleSidebar() {
    setCollapsed((c) => {
      localStorage.setItem('mms_sidebar_collapsed', String(!c));
      return !c;
    });
  }

  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading platform…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid min-h-screen bg-background transition-[grid-template-columns] duration-300"
      style={{
        gridTemplateColumns: collapsed ? '72px 1fr' : '260px 1fr',
      }}
    >
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleSidebar}
        permissions={user.permissions ?? []}
      />
      <div className="flex min-h-screen min-w-0 flex-col">
        <TopBar />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
