'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, School } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createOnboardingApplication, listOnboardingApplications, formatOnboardingStatus, DASHBOARD_STATUS_LABELS } from '@/lib/onboarding-api';
import { OnboardingDashboard } from '@/components/onboarding/onboarding-dashboard';
import { createSchoolOnboarding } from '@/lib/schools-api';
import { formatDate } from '@/lib/format';
import { useTanzaniaLocations } from '@/hooks/use-tanzania-locations';

const STATUSES = ['', ...Object.keys(DASHBOARD_STATUS_LABELS)];

export function OnboardingPageContent() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'MERCHANT' | 'SCHOOL' | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [entityType, setEntityType] = useState<'SOLE_PROPRIETOR' | 'COMPANY' | 'SCHOOL'>(
    'SOLE_PROPRIETOR',
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    legalName: '',
    tradingName: '',
    mcc: '5814',
    region: '',
    district: '',
    ward: '',
    postalCode: '',
    taxId: '',
    companyRegistrationNo: '',
    headName: '',
    contactPhone: '',
    contactEmail: '',
  });

  const { regions, districts, wards, getPostcode } = useTanzaniaLocations(
    form.region || undefined,
    form.district || undefined,
  );

  function handleRegionChange(region: string) {
    setForm((f) => ({ ...f, region, district: '', ward: '' }));
  }

  function handleDistrictChange(district: string) {
    setForm((f) => ({ ...f, district, ward: '' }));
  }

  function handleWardChange(ward: string) {
    const postcode = ward ? getPostcode(ward) : '';
    setForm((f) => ({ ...f, ward, ...(postcode ? { postalCode: postcode } : {}) }));
  }

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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (entityType === 'SCHOOL') {
        await createSchoolOnboarding(accessToken!, {
          legalName: form.legalName,
          tradingName: form.tradingName,
          region: form.region || undefined,
          district: form.district || undefined,
          ward: form.ward || undefined,
          postalCode: form.postalCode,
          taxId: form.taxId || undefined,
          headName: form.headName || undefined,
          contactPhone: form.contactPhone || undefined,
          contactEmail: form.contactEmail || undefined,
        });
      } else {
        await createOnboardingApplication(accessToken!, {
          legalEntityType: entityType,
          legalName: form.legalName,
          tradingName: form.tradingName,
          mcc: form.mcc,
          region: form.region || undefined,
          district: form.district || undefined,
          ward: form.ward || undefined,
          postalCode: form.postalCode,
          taxId: form.taxId || undefined,
          companyRegistrationNo: form.companyRegistrationNo || undefined,
          isSchool: false,
          contactPhone: form.contactPhone || undefined,
          contactEmail: form.contactEmail || undefined,
        });
      }
      setSuccess('Onboarding application created.');
      setShowCreate(false);
      await queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  const apps = query.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchant Onboarding"
        description="Sole proprietor, company, and school registration with maker-checker approval."
      >
        {canWrite && (
          <>
            <Link href="/onboarding/new">
              <Button>
                <Plus className="h-4 w-4" />
                New Wizard
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setShowCreate((s) => !s)}>
              Quick Create
            </Button>
          </>
        )}
        <Link href="/approvals">
          <Button variant="outline">Checker Inbox</Button>
        </Link>
      </PageHeader>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess(null)}>{success}</Alert>}

      <OnboardingDashboard token={accessToken!} />

      {showCreate && canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Onboarding Application</CardTitle>
            <CardDescription>Select registration type and enter merchant details.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Registration Type</Label>
                  <Select
                    value={entityType}
                    onChange={(e) =>
                      setEntityType(e.target.value as 'SOLE_PROPRIETOR' | 'COMPANY' | 'SCHOOL')
                    }
                  >
                    <option value="SOLE_PROPRIETOR">Sole Proprietor</option>
                    <option value="COMPANY">Company</option>
                    <option value="SCHOOL">School</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Legal Name</Label>
                  <Input required value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Trading Name</Label>
                  <Input required value={form.tradingName} onChange={(e) => setForm({ ...form, tradingName: e.target.value })} />
                </div>
                {entityType !== 'SCHOOL' && (
                  <div className="space-y-2">
                    <Label>MCC</Label>
                    <Input value={form.mcc} onChange={(e) => setForm({ ...form, mcc: e.target.value })} />
                  </div>
                )}
                {entityType === 'COMPANY' && (
                  <div className="space-y-2">
                    <Label>Company Registration No.</Label>
                    <Input value={form.companyRegistrationNo} onChange={(e) => setForm({ ...form, companyRegistrationNo: e.target.value })} />
                  </div>
                )}
                {entityType === 'SCHOOL' && (
                  <div className="space-y-2">
                    <Label>Head Teacher Name</Label>
                    <Input value={form.headName} onChange={(e) => setForm({ ...form, headName: e.target.value })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Select
                    value={form.region}
                    onChange={(e) => handleRegionChange(e.target.value)}
                  >
                    <option value="">Select region…</option>
                    {regions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>District</Label>
                  <Select
                    value={form.district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    disabled={!form.region}
                  >
                    <option value="">Select district…</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ward</Label>
                  <Select
                    value={form.ward}
                    onChange={(e) => handleWardChange(e.target.value)}
                    disabled={!form.district}
                  >
                    <option value="">Select ward…</option>
                    {wards.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Postal Code</Label>
                  <Input required pattern="[0-9]{5}" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
                </div>
              </div>
              <Button type="submit">
                {entityType === 'SCHOOL' ? <School className="h-4 w-4" /> : null}
                Create Application
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

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
          {query.isError && (
            <p className="p-6 text-sm text-destructive">Failed to load applications.</p>
          )}
          {!query.isLoading && !query.isError && apps.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No onboarding applications found.</p>
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
