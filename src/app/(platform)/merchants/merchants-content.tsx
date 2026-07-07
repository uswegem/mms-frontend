'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Search } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  MerchantFormFields,
  defaultMerchantFormValues,
  type MerchantFormValues,
} from '@/components/merchants/merchant-form-fields';
import { MerchantLifecycleActions } from '@/components/merchants/merchant-lifecycle-actions';
import {
  activateMerchant,
  createMerchant,
  dormantMerchant,
  exportMerchantsCsv,
  listMerchants,
  MerchantsApiError,
  suspendMerchant,
} from '@/lib/merchants-api';
import { formatDate } from '@/lib/format';

const STATUSES = [
  '',
  'DRAFT',
  'PENDING_REVIEW',
  'PENDING_APPROVAL',
  'REJECTED',
  'ACTIVE',
  'SUSPENDED',
  'DORMANT',
  'CLOSED',
];

export function MerchantsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuth();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<MerchantFormValues>(defaultMerchantFormValues);
  const [creating, setCreating] = useState(false);

  const canRead = user?.permissions?.includes('merchant:read');
  const canWrite = user?.permissions?.includes('merchant:write');
  const canSuspend = user?.permissions?.includes('merchant:suspend');

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchInput(q);
      setSearch(q);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const merchantsQuery = useQuery({
    queryKey: ['merchants', page, search, statusFilter],
    queryFn: () =>
      listMerchants(accessToken!, page, 20, search || undefined, statusFilter || undefined),
    enabled: !!accessToken && !!canRead,
  });

  if (!canRead) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">You do not have merchant:read permission.</p>
      </div>
    );
  }

  const token = accessToken!;
  const merchants = merchantsQuery.data?.data ?? [];
  const meta = merchantsQuery.data?.meta;

  function handleApiError(err: unknown) {
    setError(err instanceof MerchantsApiError ? err.message : 'An unexpected error occurred');
  }

  function handleFormChange(patch: Partial<MerchantFormValues>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await createMerchant(token, {
        legalName: form.legalName,
        tradingName: form.tradingName,
        mcc: form.mcc,
        region: form.region,
        district: form.district,
        ward: form.ward,
        postalCode: form.postalCode,
        taxId: form.taxId || undefined,
        isSchool: form.isSchool,
        addressLine1: form.addressLine1 || undefined,
        addressLine2: form.addressLine2 || undefined,
        contactPhone: form.contactPhone || undefined,
        contactEmail: form.contactEmail || undefined,
      });
      setSuccess(`Merchant "${created.tradingName}" created in DRAFT status.`);
      setForm(defaultMerchantFormValues);
      setShowCreate(false);
      await queryClient.invalidateQueries({ queryKey: ['merchants'] });
    } catch (err) {
      handleApiError(err);
    } finally {
      setCreating(false);
    }
  }

  async function runAction(label: string, id: string, fn: () => Promise<unknown>) {
    setError(null);
    setSuccess(null);
    try {
      await fn();
      setSuccess(`${label} completed.`);
      await queryClient.invalidateQueries({ queryKey: ['merchants'] });
    } catch (err) {
      handleApiError(err);
    }
  }

  function handleExport() {
    if (merchants.length === 0) {
      setError('No merchants to export on this page.');
      return;
    }
    exportMerchantsCsv(merchants);
    setSuccess('Merchant list exported to CSV.');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchant Management"
        description="Create, search, and manage merchant lifecycle and KYC compliance."
      >
        {canWrite && (
          <Button onClick={() => setShowCreate((s) => !s)}>
            <Plus className="h-4 w-4" />
            New Merchant
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {showCreate && canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Register New Merchant</CardTitle>
            <CardDescription>
              Creates a merchant in DRAFT status with KYC pending. Complete KYC on the detail page
              to activate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <MerchantFormFields values={form} onChange={handleFormChange} idPrefix="create" />
              <div className="flex gap-2">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Merchant'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Merchant Directory</CardTitle>
              <CardDescription>
                {meta ? `${meta.total} merchants enrolled` : 'Loading…'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search legal name, trading name, or tax ID…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 w-72 pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-40"
              >
                {STATUSES.map((s) => (
                  <option key={s || 'all'} value={s}>
                    {s || 'All Statuses'}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {merchantsQuery.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading merchants…</p>
          ) : merchantsQuery.isError ? (
            <p className="p-6 text-sm text-[var(--destructive)]">
              Failed to load merchants. Please try refreshing.
            </p>
          ) : merchants.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No merchants found. Try adjusting your search or filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trading Name</TableHead>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>MCC</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchants.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link
                        href={`/merchants/${m.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {m.tradingName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.legalName}</TableCell>
                    <TableCell className="font-mono text-xs">{m.mcc}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(m.status)}>{m.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(m.kyc?.status ?? 'PENDING')}>
                        {m.kyc?.status ?? 'PENDING'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.isSchool ? 'School' : 'Retail'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(m.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/merchants/${m.id}`)}
                        >
                          View
                        </Button>
                        <MerchantLifecycleActions
                          merchant={m}
                          canSuspend={!!canSuspend}
                          onSuspend={(id) =>
                            runAction('Suspend', id, () => suspendMerchant(token, id))
                          }
                          onActivate={(id) =>
                            runAction('Activate', id, () => activateMerchant(token, id))
                          }
                          onDormant={(id) =>
                            runAction('Dormant', id, () => dormantMerchant(token, id))
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {meta && meta.total > meta.limit && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {meta.page} of {Math.ceil(meta.total / meta.limit)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * meta.limit >= meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
