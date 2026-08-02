'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  FileText,
  QrCode,
  School,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MerchantEditForm } from '@/components/merchants/merchant-edit-form';
import { MerchantKycPanel } from '@/components/merchants/merchant-kyc-panel';
import { MerchantStatusPanel } from '@/components/merchants/merchant-status-panel';
import { MerchantQrTab, useMerchantQrSummary } from '@/components/merchants/qr/merchant-qr-tab';
import { SchoolStudentsPanel } from '@/components/schools/school-students-panel';
import { getMerchant } from '@/lib/merchants-api';
import { formatDateTime } from '@/lib/format';

export default function MerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') ?? 'profile';
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canWrite = user?.permissions?.includes('merchant:write');
  const canKycWrite = user?.permissions?.includes('merchant:kyc:write');
  const canKycReview = user?.permissions?.includes('merchant:kyc:review');
  const canSuspend = user?.permissions?.includes('merchant:suspend');
  const canStatusRead = user?.permissions?.includes('merchant:read');

  const merchantQuery = useQuery({
    queryKey: ['merchant', id],
    queryFn: () => getMerchant(accessToken!, id),
    enabled: !!accessToken,
  });

  const merchant = merchantQuery.data;
  const token = accessToken!;

  const qrSummaryQuery = useMerchantQrSummary(id, merchant?.status ?? 'DRAFT');

  async function refreshMerchant() {
    await queryClient.invalidateQueries({ queryKey: ['merchant', id] });
    await queryClient.invalidateQueries({ queryKey: ['merchants'] });
  }

  if (merchantQuery.isLoading) {
    return (
      <p className="py-20 text-center text-sm text-muted-foreground">Loading merchant…</p>
    );
  }

  if (!merchant) {
    return (
      <p className="py-20 text-center text-sm text-muted-foreground">Merchant not found.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/merchants">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={merchant.tradingName}
          description={`${merchant.legalName} · MCC ${merchant.mcc}`}
        >
          <Badge variant={statusBadgeVariant(merchant.status)} className="text-sm">
            {merchant.status}
          </Badge>
        </PageHeader>
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Building2 className="h-8 w-8 text-[var(--brand-navy)]" />
            <div>
              <p className="text-xs text-muted-foreground">KYC Status</p>
              <Badge variant={statusBadgeVariant(merchant.kyc?.status ?? 'PENDING')}>
                {merchant.kyc?.status ?? 'PENDING'}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <QrCode className="h-8 w-8 text-[var(--brand-navy)]" />
            <div>
              <p className="text-xs text-muted-foreground">QR Codes</p>
              <p className="text-sm font-medium">
                {qrSummaryQuery.isLoading
                  ? '…'
                  : (qrSummaryQuery.data?.label ?? '—')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Wallet className="h-8 w-8 text-[var(--brand-navy)]" />
            <div>
              <p className="text-xs text-muted-foreground">Settlement Account</p>
              <p className="text-sm font-medium">Not configured</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <School className="h-8 w-8 text-[var(--brand-navy)]" />
            <div>
              <p className="text-xs text-muted-foreground">School Merchant</p>
              <p className="text-sm font-medium">{merchant.isSchool ? 'Yes' : 'No'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={initialTab} key={initialTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          {merchant.isSchool && (
            <TabsTrigger value="students">Students</TabsTrigger>
          )}
          <TabsTrigger value="qr">QR Codes</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <MerchantEditForm
            merchant={merchant}
            token={token}
            canWrite={!!canWrite}
            onUpdated={() => void refreshMerchant()}
            onError={(msg) => setError(msg)}
            onSuccess={(msg) => setSuccess(msg)}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Created</dt>
                  <dd className="mt-1">{formatDateTime(merchant.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    Last Updated
                  </dt>
                  <dd className="mt-1">{formatDateTime(merchant.updatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    Onboarded
                  </dt>
                  <dd className="mt-1">
                    {merchant.onboardedAt
                      ? formatDateTime(merchant.onboardedAt)
                      : 'Pending KYC approval'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc">
          <MerchantKycPanel
            merchant={merchant}
            merchantId={id}
            token={token}
            canKycWrite={!!canKycWrite}
            canKycReview={!!canKycReview}
            onRefresh={refreshMerchant}
            onError={(msg) => setError(msg)}
            onSuccess={(msg) => setSuccess(msg)}
          />
        </TabsContent>

        <TabsContent value="status">
          {canStatusRead ? (
            <MerchantStatusPanel
              merchant={merchant}
              token={token}
              onUpdated={refreshMerchant}
              onError={(msg) => setError(msg)}
              onSuccess={(msg) => setSuccess(msg)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">You do not have permission to view status management.</p>
          )}
        </TabsContent>

        {merchant.isSchool && (
          <TabsContent value="students">
            <SchoolStudentsPanel merchantId={id} />
          </TabsContent>
        )}

        <TabsContent value="qr">
          <MerchantQrTab
            merchant={merchant}
            onSuccess={(msg) => setSuccess(msg)}
            onError={(msg) => setError(msg)}
          />
        </TabsContent>

        <TabsContent value="settlement">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Settlement Accounts</CardTitle>
              <CardDescription>CBS-linked accounts for net settlement</CardDescription>
            </CardHeader>
            <CardContent className="py-12 text-center">
              <Wallet className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm text-muted-foreground">
                Settlement account configuration pending CBS integration.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transaction History</CardTitle>
              <CardDescription>Payment activity for this merchant</CardDescription>
            </CardHeader>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm text-muted-foreground">
                Transactions appear when the Payments module is live.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
