'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, QrCode, XCircle } from 'lucide-react';
import {
  formatOnboardingStatus,
  formatOnboardingStep,
  type OnboardingApplication,
} from '@/lib/onboarding-api';
import { fetchMerchantQrs } from '@/lib/merchant-qr-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QrImage } from '@/components/merchants/qr/qr-image';
import { QrStatusBadge } from '@/components/merchants/qr/qr-status-badge';

interface OnboardingStoreQrPanelProps {
  app: OnboardingApplication;
  token: string;
  canWrite: boolean;
  onRegister: () => void;
  onRetry?: () => void;
}

const ALIAS_QR_READY_STATUSES = [
  'TPS_REGISTERED',
  'PENDING_ALIAS_QR_SETUP',
  'ALIAS_QR_FAILED',
];

const ALIAS_QR_DONE_STATUSES = [
  'ALIAS_QR_REGISTERED',
  'PENDING_SETTLEMENT_SETUP',
  'SETTLEMENT_REJECTED',
  'SETTLEMENT_APPROVAL_PENDING',
  'READY_FOR_ACTIVATION',
  'ACTIVE',
];

function PrereqItem({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail?: string;
}) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? 'text-[var(--success)]' : 'text-muted-foreground'}`}
      />
      <span>
        {label}
        {detail && (
          <span className="ml-1 text-xs text-muted-foreground">({detail})</span>
        )}
      </span>
    </li>
  );
}

export function OnboardingStoreQrPanel({
  app,
  token,
  canWrite,
  onRegister,
  onRetry,
}: OnboardingStoreQrPanelProps) {
  const merchant = app.merchant;
  const tipsIntegration = merchant.integrations?.find((i) => i.integrationType === 'TPS');
  const tipsStep = app.steps.find((s) => s.stepCode === 'TPS_REGISTRATION');
  const aliasStep = app.steps.find((s) => s.stepCode === 'ALIAS_QR_SETUP');

  const canRegisterAlias = ALIAS_QR_READY_STATUSES.includes(app.status);
  const aliasQrDone = ALIAS_QR_DONE_STATUSES.includes(app.status);
  const hasAlias = Boolean(merchant.alias?.alias8digit);
  const stores = merchant.stores ?? [];
  const storeWithQr = stores.find((s) => s.qrString);

  const qrQuery = useQuery({
    queryKey: ['onboarding-merchant-qr', merchant.id],
    queryFn: () => fetchMerchantQrs(token, merchant.id),
    enabled: Boolean(token && merchant.id && (hasAlias || aliasQrDone)),
  });

  const staticQr =
    qrQuery.data?.qr_codes.find(
      (q) => q.qr_type === 'static' && q.status === 'active',
    ) ?? qrQuery.data?.qr_codes.find((q) => q.qr_type === 'static');

  const tlvPayload = staticQr?.tlv_payload ?? storeWithQr?.qrString ?? null;
  const displayAlias =
    staticQr?.alias ?? merchant.alias?.alias8digit ?? storeWithQr?.alias ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Store / Alias / QR</CardTitle>
          <CardDescription>
            {merchant.isSchool
              ? 'School Lipa Namba, store record, and static TANQR are issued during onboarding after TIPS registration.'
              : 'Merchant Lipa Namba, main store, and static TANQR are issued during onboarding after TIPS registration.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Onboarding: {formatOnboardingStatus(app.status)}</Badge>
            {app.currentStep && (
              <Badge variant="primary">
                Current step: {formatOnboardingStep(app.currentStep)}
              </Badge>
            )}
            {hasAlias && (
              <Badge variant="success">Alias issued</Badge>
            )}
            {tlvPayload && (
              <Badge variant="success">QR payload ready</Badge>
            )}
          </div>

          {!canRegisterAlias && !aliasQrDone && !hasAlias && (
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--brand-yellow)_35%,transparent)] bg-[var(--accent-muted)]/40 p-4">
              <h4 className="font-medium text-sm">Alias &amp; QR not available yet</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {app.status === 'SUBMITTED' || app.status === 'PENDING_KYC_APPROVAL'
                  ? 'Complete KYC approval, bank validation, risk review, and TIPS registration before Lipa Namba and TANQR can be issued.'
                  : 'Earlier onboarding steps must finish before this step can run.'}
              </p>
              <ul className="mt-3 space-y-2">
                <PrereqItem
                  ok={app.status !== 'DRAFT'}
                  label="Application submitted"
                  detail={formatOnboardingStatus(app.status)}
                />
                <PrereqItem
                  ok={!['SUBMITTED', 'PENDING_KYC_APPROVAL', 'DRAFT', 'KYC_REJECTED'].includes(app.status)}
                  label="KYC approved"
                />
                <PrereqItem
                  ok={Boolean(merchant.settlementAccount?.verifiedAt) || ['BANK_VALIDATED', 'TPS_REGISTERED', 'ALIAS_QR_REGISTERED', 'ACTIVE'].includes(app.status)}
                  label="Bank account validated"
                  detail={merchant.settlementAccount ? (merchant.settlementAccount.verifiedAt ? 'Verified' : 'Assigned') : 'Not assigned'}
                />
                <PrereqItem
                  ok={tipsIntegration?.status === 'SUCCESS' || Boolean(tipsStep?.completedAt)}
                  label="TIPS registration"
                  detail={tipsIntegration?.status ?? 'Pending'}
                />
                <PrereqItem
                  ok={hasAlias || Boolean(aliasStep?.completedAt)}
                  label="Alias / Lipa Namba & static QR"
                />
              </ul>
            </div>
          )}

          {canRegisterAlias && canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onRegister}>
                Register Alias &amp; QR
              </Button>
              {app.status === 'ALIAS_QR_FAILED' && onRetry && (
                <Button size="sm" variant="outline" onClick={onRetry}>
                  Retry Alias / QR
                </Button>
              )}
            </div>
          )}

          {hasAlias && (
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Lipa Namba</p>
              <p className="mt-1 text-2xl font-bold tracking-widest font-mono">
                {displayAlias}
              </p>
            </div>
          )}

          {(tlvPayload || staticQr) && (
            <div className="grid gap-6 rounded-lg border border-border p-4 lg:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center gap-2">
                <QrImage
                  tlvPayload={tlvPayload ?? undefined}
                  assets={staticQr?.assets}
                  size={200}
                />
                {displayAlias && (
                  <p className="text-lg font-bold tracking-wide">{displayAlias}</p>
                )}
                <p className="text-sm text-muted-foreground">{merchant.tradingName}</p>
                {staticQr && <QrStatusBadge status={staticQr.status} />}
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>Merchant:</strong> {merchant.tradingName}</p>
                <p><strong>MCC:</strong> {merchant.mcc}</p>
                {staticQr && (
                  <>
                    <p><strong>Version:</strong> {staticQr.version}</p>
                    <p><strong>CRC:</strong> <span className="font-mono">{staticQr.crc}</span></p>
                  </>
                )}
                {stores.map((s) => (
                  <div key={s.id} className="mt-2 rounded border border-border/60 p-2 text-xs">
                    <p><strong>{s.storeName}</strong> ({s.storeCode})</p>
                    <p>Terminal: {s.terminalId ?? '—'} · Status: {s.status}</p>
                    {s.lipaNambaHandle && <p>{s.lipaNambaHandle}</p>}
                  </div>
                ))}
                {app.merchantId && (
                  <Link href={`/merchants/${app.merchantId}?tab=qr`}>
                    <Button size="sm" variant="outline" className="mt-2">
                      Open full QR management
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {!hasAlias && !tlvPayload && aliasQrDone && (
            <div className="flex flex-col items-center py-8 text-center">
              <QrCode className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Alias/QR step marked complete but no QR data returned. Try registering again or open merchant QR management.
              </p>
              {canWrite && (
                <Button size="sm" className="mt-3" onClick={onRegister}>
                  Register Alias &amp; QR
                </Button>
              )}
            </div>
          )}

          {!hasAlias && !tlvPayload && !canRegisterAlias && !aliasQrDone && (
            <div className="flex flex-col items-center rounded-lg border border-dashed border-border py-10 text-center">
              <QrCode className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                No store, alias, or QR has been issued for this application yet. Use the
                checklist above to see which steps remain.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
