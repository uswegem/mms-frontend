'use client';

import { Calendar, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
  userName?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function DashboardHeader({ userName, onRefresh, isRefreshing }: DashboardHeaderProps) {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {greeting}{userName ? `, ${userName.split('@')[0]}` : ''}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {today} · Network operations overview
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex">
          Period: <span className="ml-1 font-medium text-foreground">Today</span>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" size="sm">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>
    </div>
  );
}
