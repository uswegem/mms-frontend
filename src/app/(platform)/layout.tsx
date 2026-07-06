import { AppShell } from '@/components/layout/app-shell';
import { PermissionRouteGuard } from '@/components/auth/permission-route-guard';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <PermissionRouteGuard>{children}</PermissionRouteGuard>
    </AppShell>
  );
}
