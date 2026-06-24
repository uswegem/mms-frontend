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
import { createOnboardingApplication, listOnboardingApplications } from '@/lib/onboarding-api';
import { createSchoolOnboarding } from '@/lib/schools-api';
import { formatDate } from '@/lib/format';

const STATUSES = ['', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

export function OnboardingPageContent() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
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
    city: 'Dar es Salaam',
    postalCode: '11000',
    taxId: '',
    companyRegistrationNo: '',
    headName: '',
    contactPhone: '',
    contactEmail: '',
  });

  const canRead = user?.permissions?.includes('onboarding:read');
  const canWrite = user?.permissions?.includes('onboarding:write');

  const query = useQuery({
    queryKey: ['onboarding', statusFilter],
    queryFn: () => listOnboardingApplications(accessToken!, 1, statusFilter || undefined),
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
          city: form.city,
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
          mcc: entityType === 'COMPANY' ? form.mcc : form.mcc,
          city: form.city,
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
          <Button onClick={() => setShowCreate((s) => !s)}>
            <Plus className="h-4 w-4" />
            New Application
          </Button>
        )}
        <Link href="/approvals">
          <Button variant="outline">Checker Inbox</Button>
        </Link>
      </PageHeader>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess(null)}>{success}</Alert>}

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
                  <Label>City</Label>
                  <Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
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
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Application Queue</CardTitle>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
            {STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>{s || 'All Statuses'}</option>
            ))}
          </Select>
        </CardHeader>
        <CardContent className="p-0">
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
                    <Badge variant={statusBadgeVariant(app.status)}>{app.status}</Badge>
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
        </CardContent>
      </Card>
    </div>
  );
}
