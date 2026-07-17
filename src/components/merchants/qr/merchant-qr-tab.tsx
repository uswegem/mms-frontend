'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QrCode, RefreshCw } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import type { Merchant } from '@/lib/merchants-api';
import {
  createDynamicQr,
  disableQr,
  fetchMerchantQrs,
  generateStaticQr,
  regenerateQr,
} from '@/lib/merchant-qr-api';
import {
  canCreateQr,
  canDisableQr,
  canDownloadQr,
  canRegenerateQr,
  isQrGenerationBlocked,
  isQrGenerationEligible,
} from '@/lib/qr-permissions';
import type { MerchantQrCode } from '@/types/merchant-qr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { QrEligibilityBlocker } from './qr-eligibility-blocker';
import { StaticQrCard } from './static-qr-card';
import { DynamicQrTable } from './dynamic-qr-table';
import { QrPreviewModal } from './qr-preview-modal';
import { GenerateStaticQrModal } from './generate-static-qr-modal';
import { CreateDynamicQrModal } from './create-dynamic-qr-modal';
import { PrintableQrDisplay } from './printable-qr-display';
import { listStudents } from '@/lib/students-api';
import { formatDateTime } from '@/lib/format';
import { QrStatusBadge } from './qr-status-badge';

interface MerchantQrTabProps {
  merchant: Merchant;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export function MerchantQrTab({ merchant, onSuccess, onError }: MerchantQrTabProps) {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const token = accessToken!;

  const [previewQr, setPreviewQr] = useState<MerchantQrCode | null>(null);
  const [printQr, setPrintQr] = useState<MerchantQrCode | null>(null);
  const [staticModalOpen, setStaticModalOpen] = useState(false);
  const [dynamicModalOpen, setDynamicModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const canCreate = canCreateQr(user);
  const canRegen = canRegenerateQr(user);
  const canDisable = canDisableQr(user);
  const canDownload = canDownloadQr(user);

  const qrQuery = useQuery({
    queryKey: ['merchant-qr', merchant.id],
    queryFn: () => fetchMerchantQrs(token, merchant.id),
    enabled: !!accessToken,
  });

  const studentsQuery = useQuery({
    queryKey: ['students', merchant.id],
    queryFn: () => listStudents(token, merchant.id),
    enabled: !!accessToken && merchant.isSchool,
  });

  const blocked = !isQrGenerationEligible(merchant.status, qrQuery.data?.eligibility);
  const statusBlocked = isQrGenerationBlocked(merchant.status);

  const staticQrs = useMemo(
    () => qrQuery.data?.qr_codes.filter((q) => q.qr_type === 'static' && !q.student_id) ?? [],
    [qrQuery.data],
  );
  const dynamicQrs = useMemo(
    () => qrQuery.data?.qr_codes.filter((q) => q.qr_type === 'dynamic') ?? [],
    [qrQuery.data],
  );
  const studentQrs = useMemo(
    () => qrQuery.data?.qr_codes.filter((q) => q.student_id) ?? [],
    [qrQuery.data],
  );

  const primaryStatic = staticQrs.find((q) => q.status === 'active') ?? staticQrs[0];

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['merchant-qr', merchant.id] });
    await queryClient.invalidateQueries({ queryKey: ['merchant-summary-qr', merchant.id] });
  }

  async function handleGenerateStatic(body: Parameters<typeof generateStaticQr>[2]) {
    setActionLoading(true);
    try {
      const result = await generateStaticQr(token, merchant.id, body);
      await refresh();
      onSuccess?.('Static QR generated successfully');
      setStaticModalOpen(false);
      const updated = await fetchMerchantQrs(token, merchant.id);
      const found = updated.qr_codes.find((q) => q.id === result.qr_id) ?? updated.qr_codes[0];
      if (found) setPreviewQr(found);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate static QR';
      onError?.(msg);
      if (process.env.NODE_ENV === 'development') console.error(e);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreateDynamic(body: Parameters<typeof createDynamicQr>[2]) {
    setActionLoading(true);
    try {
      const result = await createDynamicQr(token, merchant.id, body);
      await refresh();
      onSuccess?.('Dynamic QR generated successfully');
      setDynamicModalOpen(false);
      const updated = await fetchMerchantQrs(token, merchant.id);
      const found = updated.qr_codes.find((q) => q.id === result.qr_id);
      if (found) setPreviewQr(found);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create dynamic QR';
      onError?.(msg);
      if (process.env.NODE_ENV === 'development') console.error(e);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRegenerate(qr: MerchantQrCode) {
    if (!confirm('Regenerate static QR? A new payload version will be created.')) return;
    setActionLoading(true);
    try {
      await regenerateQr(token, qr.id);
      await refresh();
      onSuccess?.('QR regenerated successfully');
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisable(qr: MerchantQrCode) {
    if (!confirm('Disable this QR code?')) return;
    setActionLoading(true);
    try {
      await disableQr(token, qr.id);
      await refresh();
      onSuccess?.('QR disabled');
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Disable failed');
    } finally {
      setActionLoading(false);
    }
  }

  function copyPayload(payload: string) {
    void navigator.clipboard.writeText(payload);
    onSuccess?.('Payload copied to clipboard');
  }

  if (qrQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (qrQuery.isError) {
    if (process.env.NODE_ENV === 'development') {
      console.error(qrQuery.error);
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unable to load QR codes</CardTitle>
          <CardDescription>
            We could not fetch QR codes for this merchant. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void qrQuery.refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const subtitle = merchant.isSchool
    ? 'School, student, and invoice TANQR codes for fee collection.'
    : 'Static and dynamic TANQR codes for this merchant.';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">QR Codes</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
          {!blocked && canCreate && (
            <>
              <Button size="sm" onClick={() => setStaticModalOpen(true)}>
                Generate Static QR
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDynamicModalOpen(true)}>
                Create Dynamic QR
              </Button>
            </>
          )}
        </div>
      </div>

      {blocked && (
        <QrEligibilityBlocker
          merchant={merchant}
          eligibility={qrQuery.data?.eligibility}
          statusBlocked={statusBlocked}
          onRefresh={() => void refresh()}
        />
      )}

      {!blocked && (qrQuery.data?.qr_codes.length ?? 0) === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <QrCode className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 font-medium">No QR codes issued yet</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Generate a static merchant QR for reusable payments, or create a dynamic QR for a
              fixed amount or bill.
            </p>
            {canCreate && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button onClick={() => setStaticModalOpen(true)}>Generate Static QR</Button>
                <Button variant="outline" onClick={() => setDynamicModalOpen(true)}>
                  Create Dynamic QR
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {primaryStatic && (
        <StaticQrCard
          qr={primaryStatic}
          canRegenerate={canRegen}
          canDisable={canDisable}
          canDownload={canDownload}
          onView={() => setPreviewQr(primaryStatic)}
          onPrint={() => setPrintQr(primaryStatic)}
          onRegenerate={() => void handleRegenerate(primaryStatic)}
          onDisable={() => void handleDisable(primaryStatic)}
          onCopyPayload={copyPayload}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dynamic QR Codes</CardTitle>
          <CardDescription>
            Dynamic QR codes are generated for fixed amount payments, invoices, or bills.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DynamicQrTable
            items={dynamicQrs}
            canDisable={canDisable}
            canDownload={canDownload}
            onView={setPreviewQr}
            onPrint={setPrintQr}
            onCopyPayload={copyPayload}
            onDisable={(q) => void handleDisable(q)}
          />
          {!blocked && canCreate && dynamicQrs.length === 0 && (
            <Button className="mt-4" size="sm" onClick={() => setDynamicModalOpen(true)}>
              Create Dynamic QR
            </Button>
          )}
        </CardContent>
      </Card>

      {merchant.isSchool && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">School / Student QR Codes</CardTitle>
            <CardDescription>
              Public Lipa Namba in tag 26/02. Internal routing IDs are for MMS only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {studentQrs.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-2">Student</th>
                      <th className="p-2">Admission</th>
                      <th className="p-2">Lipa Namba</th>
                      <th className="p-2">QR status</th>
                      <th className="p-2">Created</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentQrs.map((qr) => (
                      <tr key={qr.id} className="border-b border-border/60">
                        <td className="p-2">{qr.student_name ?? '—'}</td>
                        <td className="p-2">{qr.admission_no ?? '—'}</td>
                        <td className="p-2 font-mono font-medium">{qr.alias}</td>
                        <td className="p-2"><QrStatusBadge status={qr.status} /></td>
                        <td className="p-2 text-xs">{formatDateTime(qr.created_at)}</td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => setPreviewQr(qr)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Student QRs are created when students are enrolled from the Students tab.
              </p>
            )}
            {(studentsQuery.data?.length ?? 0) > 0 && studentQrs.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {studentsQuery.data!.length} student(s) enrolled — QR records will appear after alias issuance.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <QrPreviewModal
        open={!!previewQr}
        qr={previewQr}
        user={user}
        onClose={() => setPreviewQr(null)}
        onCopyPayload={copyPayload}
      />

      <PrintableQrDisplay
        open={!!printQr}
        qr={printQr}
        onClose={() => setPrintQr(null)}
      />

      <GenerateStaticQrModal
        open={staticModalOpen}
        loading={actionLoading}
        onClose={() => setStaticModalOpen(false)}
        onSubmit={handleGenerateStatic}
      />

      <CreateDynamicQrModal
        open={dynamicModalOpen}
        loading={actionLoading}
        onClose={() => setDynamicModalOpen(false)}
        onSubmit={handleCreateDynamic}
      />
    </div>
  );
}

export function useMerchantQrSummary(merchantId: string, merchantStatus: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['merchant-summary-qr', merchantId],
    queryFn: () => fetchMerchantQrs(accessToken!, merchantId),
    enabled: !!accessToken,
    select: (data) => ({
      summary: data.summary,
      label: isQrGenerationBlocked(merchantStatus)
        ? merchantStatus === 'SUSPENDED' || merchantStatus === 'REJECTED'
          ? 'Blocked'
          : 'Not available'
        : data.summary.total === 0
          ? 'No QR issued'
          : `${data.summary.active} active`,
    }),
  });
}
