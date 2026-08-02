'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listOnboardingApplications, formatOnboardingStatus, DASHBOARD_STATUS_LABELS } from '@/lib/onboarding-api';
import { OnboardingDashboard } from '@/components/onboarding/onboarding-dashboard';
import { formatDate } from '@/lib/format';

const STATUSES = ['', ...Object.keys(DASHBOARD_STATUS_LABELS)];

export function OnboardingPageContent() {
  const { accessToken, user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'MERCHANT' | 'SCHOOL' | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const canRead = user?.permissions?.includes('onboarding:read');
  const canWrite = user?.permissions?.includes('onboarding:write');

  const query = useQuery({
    queryKey: ['onboarding', statusFilter, typeFilter, search, page],
    queryFn: () => listOnboardingApplications(accessToken!, page, statusFilter || undefined, search || undefined, 20, typeFilter || undefined),
    enabled: !!accessToken && !!canRead,
  });

  if (!canRead) {
    return (
      <p className="py-20 text-center text-sm text-muted-foreground">
        You need onboarding:read permission.
      </p>
    );
  }

  const apps = query.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchant Onboarding"
        description="Sole proprietor, company, and school registration with maker-checker approval."
      >
        {canWrite && (
          <Link href="/onboarding/new">
            <Button>
              <Plus className="h-4 w-4" />
              New Wizard
            </Button>
          </Link>
        )}
        <Link href="/approvals">
          <Button variant="outline">Merchant Approval</Button>
        </Link>
      </PageHeader>

      <OnboardingDashboard token={accessToken!} />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Application Queue</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search name, PAN, email, alias…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-56"
            />
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-48">
              {STATUSES.map((s) => (
                <option key={s || 'all'} value={s}>{s ? formatOnboardingStatus(s) : 'All Statuses'}</option>
              ))}
            </Select>
            <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as typeof typeFilter); setPage(1); }} className="w-40">
              <option value="">All Types</option>
              <option value="MERCHANT">Merchant</option>
              <option value="SCHOOL">School</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading && (
            <p className="p-6 text-sm text-muted-foreground">Loading applications…</p>
          )}
          {!query.isLoading && apps.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No onboarding applications found.</p>
          )}
          {query.isError && (
            <p className="p-6 text-sm text-destructive">Failed to load applications.</p>
          )}
          {apps.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application No.</TableHead>
                <TableHead>Trading Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-mono text-xs">{app.applicationNo}</TableCell>
                  <TableCell>{app.merchant.tradingName}</TableCell>
                  <TableCell>
                    {app.merchant.isSchool ? 'School' : app.legalEntityType.replace('_', ' ')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(app.status)}>{formatOnboardingStatus(app.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(app.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/onboarding/${app.id}`}>
                      <Button variant="ghost" size="sm">Open</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
          {query.data && query.data.meta.total > 20 && (
            <div className="flex justify-end gap-2 border-t border-border p-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page * 20 >= query.data.meta.total} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
