'use client';

import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/ui/stat-card';
import { getOnboardingDashboard, DASHBOARD_STATUS_LABELS } from '@/lib/onboarding-api';

export function OnboardingDashboard({ token }: { token: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-dashboard'],
    queryFn: () => getOnboardingDashboard(token),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  }

  const counts = data?.counts ?? {};
  const entries = Object.entries(DASHBOARD_STATUS_LABELS)
    .map(([status, label]) => ({ status, label, count: counts[status] ?? 0 }))
    .filter((e) => e.count > 0);

  const topStatuses = entries.length
    ? entries
    : Object.entries(DASHBOARD_STATUS_LABELS).slice(0, 8).map(([status, label]) => ({
        status,
        label,
        count: counts[status] ?? 0,
      }));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Total Applications" value={String(data?.total ?? 0)} />
      {topStatuses.slice(0, 7).map((s) => (
        <StatCard key={s.status} title={s.label} value={String(s.count)} />
      ))}
    </div>
  );
}
