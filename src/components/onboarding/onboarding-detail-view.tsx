'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { OnboardingStoreQrPanel } from '@/components/onboarding/onboarding-store-qr-panel';
import { DEFAULT_BANK_SWIFT, formatBankDisplay, formatBankLabel, TANZANIA_BANKS } from '@/lib/tanzania-banks';
import { listApprovalTasks, approveTask, rejectTask } from '@/lib/approvals-api';
import { ONBOARDING_REJECTION_CODES } from '@/components/ui/reject-modal';
import {
  activateOnboarding,
  approveKyc,
  approveRisk,
  approveSettlement,
  assignSettlementAccount,
  getApplicationFeeSchedule,
  getOnboardingApplication,
  getOnboardingAuditLogs,
  getOnboardingTimeline,
  makerApproveOnboarding,
  registerTips,
  retryTips,
  registerAliasQr,
  retryAliasQr,
  rejectOnboarding,
  resubmitOnboarding,
  rejectKyc,
  sendBackOnboarding,
  saveSettlement,
  submitOnboarding,
  uploadOnboardingKycFile,
  verifySettlement,
  formatOnboardingStatus,
  formatAuditAction,
  ONBOARDING_WIZARD_STEPS,
  type OnboardingApplication,
} from '@/lib/onboarding-api';

const TABS = [
  { key: 'profile', label: 'Overview' },
  { key: 'kyc', label: 'KYC' },
  { key: 'bank', label: 'Bank' },
  { key: 'risk', label: 'Risk' },
  { key: 'tips', label: 'TIPS' },
  { key: 'store', label: 'Store / QR' },
  { key: 'settlement', label: 'Settlement' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'audit', label: 'Audit' },
] as const;

const EDITABLE_STATUSES = [
  'DRAFT',
  'KYC_REJECTED',
  'RISK_REJECTED',
  'REJECTED',
  'PENDING_KYC_DOCUMENTS',
  'PENDING_SETTLEMENT_SETUP',
  'SETTLEMENT_REJECTED',
  'BANK_VALIDATION_FAILED',
  'TPS_REGISTRATION_FAILED',
  'ALIAS_QR_FAILED',
];

const STATUS_GUIDANCE: Partial<Record<string, string>> = {
  DRAFT: 'Complete the application and submit it for maker review.',
  SUBMITTED: 'Review the application and send it for checker approval.',
  UNDER_REVIEW: 'Awaiting checker decision below.',
  PENDING_KYC_APPROVAL: 'Review KYC documents and approve or reject.',
  PENDING_RISK_REVIEW: 'Conduct risk assessment and approve or reject.',
  PENDING_BANK_VALIDATION: 'Verify the settlement bank account via CBS.',
  BANK_VALIDATION_FAILED: 'Bank verification failed. Retry or reject.',
  BANK_VALIDATED: 'Register the merchant with TIPS (TANQR Interbank Payment System).',
  PENDING_TPS_REGISTRATION: 'TIPS registration in progress.',
  TPS_REGISTRATION_FAILED: 'TIPS registration failed. Retry or reject.',
  TPS_REGISTERED: 'Register the store alias and generate the QR code.',
  ALIAS_QR_FAILED: 'Alias/QR registration failed. Retry or reject.',
  ALIAS_QR_REGISTERED: 'Alias and QR issued. Configure settlement terms to continue.',
  PENDING_SETTLEMENT_SETUP: 'Submit settlement configuration for approval.',
  SETTLEMENT_APPROVAL_PENDING: 'Review and approve settlement configuration.',
  SETTLEMENT_REJECTED: 'Settlement was rejected. Reconfigure and resubmit.',
  SETTLEMENT_APPROVED: 'All steps complete. Ready to activate the merchant.',
  READY_FOR_ACTIVATION: 'Activate the merchant to complete onboarding.',
  ACTIVE: 'Onboarding complete — merchant is live.',
  REJECTED: 'Application rejected. Correct issues and resubmit.',
  KYC_REJECTED: 'KYC was rejected. Correct documents and resubmit.',
  RISK_REJECTED: 'Risk review failed. Correct and resubmit.',
};

function statusPillClass(status: string): string {
  if (['ACTIVE', 'SUCCESS', 'APPROVED', 'POSTED', 'PAID'].includes(status)) {
    return 'bg-success-bg text-success-text';
  }
  if (['PENDING', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'SUBMITTED', 'UNDER_REVIEW'].includes(status)) {
    return 'bg-warning-bg text-warning-text-dark';
  }
  if (['SUSPENDED', 'FAILED', 'REJECTED'].includes(status) || status.endsWith('_FAILED') || status.endsWith('_REJECTED')) {
    return 'bg-danger-bg text-danger-text';
  }
  return 'bg-track text-text-muted';
}

function verifyChipClass(ok: boolean): string {
  return ok
    ? 'border-success-border bg-success-bg-soft text-success-text-dark'
    : 'border-border-default bg-subtle text-text-muted';
}

export function OnboardingDetailView({ id }: { id: string }) {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['key']>('profile');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankCode, setBankCode] = useState(DEFAULT_BANK_SWIFT);
  const [settlement, setSettlement] = useState({
    settlementAlias: '',
    payoutCycle: 'DAILY',
    mdr: '0.015',
    dailyLimit: '5000000',
  });

  const token = accessToken!;
  const canWrite = user?.permissions?.includes('onboarding:write');
  const canSubmit = user?.permissions?.includes('onboarding:submit');
  const canApprove = user?.permissions?.includes('onboarding:approve');
  const canReject = user?.permissions?.includes('onboarding:reject');
  const canApproveTask = user?.permissions?.includes('approval:task:approve');
  const canRejectTask = user?.permissions?.includes('approval:task:reject');

  const appQuery = useQuery({
    queryKey: ['onboarding', id],
    queryFn: () => getOnboardingApplication(token, id),
    enabled: !!accessToken,
  });
  const timelineQuery = useQuery({
    queryKey: ['onboarding-timeline', id],
    queryFn: () => getOnboardingTimeline(token, id),
    enabled: !!accessToken,
  });
  const auditQuery = useQuery({
    queryKey: ['onboarding-audit', id],
    queryFn: () => getOnboardingAuditLogs(token, id),
    enabled: !!accessToken,
  });
  const feeScheduleQuery = useQuery({
    queryKey: ['onboarding-fee-schedule', id],
    queryFn: () => getApplicationFeeSchedule(token, id),
    enabled: !!accessToken,
    retry: false,
  });
  const tasksQuery = useQuery({
    queryKey: ['approval-tasks-all'],
    queryFn: () => listApprovalTasks(token, ''),
    enabled: !!accessToken && (!!canApproveTask || !!canRejectTask),
  });

  const app = appQuery.data;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['onboarding', id] }),
      queryClient.invalidateQueries({ queryKey: ['onboarding-timeline', id] }),
      queryClient.invalidateQueries({ queryKey: ['onboarding-audit', id] }),
      queryClient.invalidateQueries({ queryKey: ['onboarding-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['approval-tasks-all'] }),
      queryClient.invalidateQueries({ queryKey: ['approval-tasks'] }),
    ]);
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      setSuccess(`${label} completed.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    }
  }

  if (appQuery.isLoading || !app) {
    return <p className="py-20 text-center text-[13px] text-text-muted">Loading…</p>;
  }

  const editable = EDITABLE_STATUSES.includes(app.status);
  const guidance = STATUS_GUIDANCE[app.status];

  const primaryOwner = app.beneficialOwners?.[0];
  const nidaResult = primaryOwner?.nidaVerifications?.[0] ?? null;
  const traResult = app.traVerifications?.[0] ?? null;
  const cbsVerified = !!app.merchant.settlementAccount?.verifiedAt;
  const feeAccepted = feeScheduleQuery.data?.accepted ?? false;

  const pendingTask = (tasksQuery.data?.data ?? []).find(
    (t) =>
      t.entityId === id &&
      ['MERCHANT_ONBOARDING', 'SCHOOL_ONBOARDING'].includes(t.entityType) &&
      t.status === 'PENDING',
  );
  const isMaker = pendingTask?.makerId === user?.sub;

  return (
    <div className="-m-6 flex flex-col p-[26px_34px_34px]">
      <div className="mb-4 flex items-center gap-2.5 text-[13px]">
        <Link href="/onboarding" className="flex items-center gap-1.5 text-accent-link hover:text-accent-link-hover">
          <ArrowLeft className="h-3.5 w-3.5" /> Queue
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="font-mono text-text-muted">{app.applicationNo}</span>
      </div>

      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-text-primary">
            {app.merchant.tradingName}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {app.legalEntityType.replace(/_/g, ' ')} · {app.merchant.profile?.district ?? '—'},{' '}
            {app.merchant.profile?.region ?? '—'} · created {new Date(app.createdAt).toLocaleDateString('en-GB')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded-[20px] px-[11px] py-[5px] text-[12px] font-medium', statusPillClass(app.status))}>
            {formatOnboardingStatus(app.status)}
          </span>
          {app.merchant.merchantCode && (
            <span className="rounded-[20px] border border-border-default bg-surface px-[11px] py-[5px] font-mono text-[12px] text-text-muted">
              {app.merchant.merchantCode}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-[10px] border border-danger bg-danger-bg px-4 py-2.5 text-[13px] text-danger-text">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-[10px] border border-success-border bg-success-bg px-4 py-2.5 text-[13px] text-success-text">
          {success}
        </div>
      )}

      <div className="mb-5 grid grid-cols-4 gap-[10px]">
        <div className={cn('rounded-[10px] border px-3.5 py-3', verifyChipClass(nidaResult?.result === 'MATCH'))}>
          <p className="text-[11px] uppercase tracking-[.06em] opacity-75">NIDA</p>
          <p className="mt-1 text-[13px] font-medium">
            {nidaResult?.result === 'MATCH' ? 'Verified · name match' : nidaResult ? 'Not matched' : 'Not verified'}
          </p>
        </div>
        <div className={cn('rounded-[10px] border px-3.5 py-3', verifyChipClass(traResult?.result === 'MATCH'))}>
          <p className="text-[11px] uppercase tracking-[.06em] opacity-75">TRA TIN</p>
          <p className="mt-1 text-[13px] font-medium">
            {traResult?.result === 'MATCH' ? 'Active taxpayer' : traResult ? 'Not matched' : 'Not verified'}
          </p>
        </div>
        <div className={cn('rounded-[10px] border px-3.5 py-3', verifyChipClass(cbsVerified))}>
          <p className="text-[11px] uppercase tracking-[.06em] opacity-75">CBS account</p>
          <p className="mt-1 text-[13px] font-medium">{cbsVerified ? 'Valid · ownership match' : 'Not verified'}</p>
        </div>
        <div className={cn('rounded-[10px] border px-3.5 py-3', verifyChipClass(feeAccepted))}>
          <p className="text-[11px] uppercase tracking-[.06em] opacity-75">Fee schedule</p>
          <p className="mt-1 text-[13px] font-medium">
            {feeAccepted ? `Accepted v${feeScheduleQuery.data?.schedule.version}` : 'Not yet accepted'}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          {guidance && (
            <div className="rounded-[10px] border border-border-default bg-subtle px-4 py-2.5 text-[13px] text-text-body">
              {guidance}
            </div>
          )}

          <WorkflowActions
            app={app}
            canWrite={!!canWrite}
            canSubmit={!!canSubmit}
            canApprove={!!canApprove}
            canReject={!!canReject}
            token={token}
            id={id}
            run={run}
            onGoToSettlement={() => setActiveTab('settlement')}
          />

          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={
                  activeTab === tab.key
                    ? 'rounded-[20px] bg-button-primary px-[13px] py-[6px] text-[12.5px] font-medium text-white'
                    : 'rounded-[20px] border border-border-default bg-surface px-[13px] py-[6px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]'
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'profile' && (
            <div className="rounded-[14px] border border-border-default bg-surface p-[22px]">
              <p className="mb-3 text-[13px] font-semibold text-text-primary">
                KYC field set — {app.legalEntityType.replace(/_/g, ' ')}
              </p>
              <dl className="grid grid-cols-2 gap-x-6 text-[13px]">
                {[
                  ['Business name', app.merchant.tradingName],
                  ['Legal name', app.merchant.legalName],
                  ['Owner', primaryOwner?.fullName ?? '—'],
                  ['MCC', `${app.merchant.mcc}${app.merchant.businessCategory ? ` — ${app.merchant.businessCategory}` : ''}`],
                  ['TIN', app.merchant.taxId ?? '—'],
                  ['VRN', app.merchant.vrn ?? '—'],
                  ['License no', app.merchant.licenseNumber ?? '—'],
                  ['Region / District', `${app.merchant.profile?.region ?? '—'} / ${app.merchant.profile?.district ?? '—'}`],
                  ['Address', app.merchant.profile?.addressLine1 ?? '—'],
                  ['Phone', app.merchant.profile?.contactPhone ?? '—'],
                  ['Email', app.merchant.profile?.contactEmail ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-border-row py-2">
                    <dt className="text-text-muted">{label}</dt>
                    <dd className="text-text-primary">{value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mb-3 mt-6 text-[13px] font-semibold text-text-primary">Attachments</p>
              <div className="flex flex-wrap gap-2.5">
                {(app.merchant.documents ?? []).map((d) => (
                  <span
                    key={d.id}
                    className="flex items-center gap-2 rounded-[10px] border border-border-default px-3 py-2 text-[12.5px] text-text-body"
                  >
                    <span className="h-[26px] w-[20px] rounded-[4px] border border-border-default bg-track" />
                    {d.docType.replace(/_/g, ' ')}
                  </span>
                ))}
                {(app.merchant.documents ?? []).length === 0 && (
                  <p className="text-[12.5px] text-text-muted">No documents uploaded yet.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'kyc' && (
            <div className="rounded-[14px] border border-border-default bg-surface p-[22px]">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-text-primary">KYC documents</p>
                {canWrite && editable && (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void run('Document upload', () => uploadOnboardingKycFile(token, id, file, 'KYC_ID'));
                      }}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="rounded-[8px] border border-border-input px-3 py-[7px] text-[12.5px] text-text-body hover:border-[#c9c9c3]"
                    >
                      Upload KYC ID
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {(app.merchant.documents ?? []).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-[10px] border border-border-default px-4 py-2.5 text-[13px]"
                  >
                    <span className="text-text-primary">
                      {d.docType.replace(/_/g, ' ')} <span className="text-text-muted">— {d.fileName}</span>
                    </span>
                    <span
                      className={cn(
                        'rounded-[20px] px-[10px] py-[3px] text-[11.5px] font-medium',
                        d.verificationStatus === 'VERIFIED'
                          ? 'bg-success-bg text-success-text'
                          : 'bg-warning-bg text-warning-text-dark',
                      )}
                    >
                      {d.verificationStatus}
                    </span>
                  </div>
                ))}
                {(app.merchant.documents ?? []).length === 0 && (
                  <p className="text-[12.5px] text-text-muted">No documents uploaded yet.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'bank' && (
            <div className="rounded-[14px] border border-border-default bg-surface p-[22px]">
              <p className="mb-3 text-[13px] font-semibold text-text-primary">Settlement bank account</p>
              {app.merchant.settlementAccount ? (
                <div className="flex flex-col gap-1.5 text-[13px]">
                  <p className="text-text-primary">{formatBankDisplay(app.merchant.settlementAccount.bankCode)}</p>
                  <p className="text-text-body">{app.merchant.settlementAccount.accountName}</p>
                  <p className="font-mono text-text-body">{app.merchant.settlementAccount.accountNumber}</p>
                  <p className="text-text-muted">
                    {app.merchant.settlementAccount.verifiedAt ? 'CBS verified' : 'Pending verification'}
                  </p>
                  {canWrite && (
                    <button
                      onClick={() => run('Bank validation', () => verifySettlement(token, id))}
                      className="mt-2 w-fit rounded-[8px] border border-border-input px-3 py-[7px] text-[12.5px] text-text-body hover:border-[#c9c9c3]"
                    >
                      Verify account
                    </button>
                  )}
                </div>
              ) : canWrite && editable ? (
                <div className="flex max-w-md flex-col gap-3">
                  <SimpleField label="Account number" value={accountNumber} onChange={setAccountNumber} />
                  <SimpleField label="Account name" value={accountName} onChange={setAccountName} />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] text-text-body">Bank</span>
                    <select
                      value={bankCode}
                      onChange={(e) => setBankCode(e.target.value)}
                      className="rounded-[9px] border border-border-input bg-surface px-3 py-[10px] text-[13.5px] text-text-primary outline-none focus:border-accent"
                    >
                      {TANZANIA_BANKS.map((bank) => (
                        <option key={bank.swiftCode} value={bank.swiftCode}>
                          {formatBankLabel(bank)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() =>
                      run('Settlement assigned', () => assignSettlementAccount(token, id, { accountNumber, accountName, bankCode }))
                    }
                    className="w-fit rounded-[9px] bg-button-primary px-4 py-[9px] text-[13px] font-medium text-white hover:bg-button-primary-hover"
                  >
                    Assign account
                  </button>
                </div>
              ) : (
                <p className="text-[13px] text-text-muted">No settlement account assigned.</p>
              )}
            </div>
          )}

          {activeTab === 'risk' && (
            <div className="rounded-[14px] border border-border-default bg-surface p-[22px]">
              <p className="mb-3 text-[13px] font-semibold text-text-primary">Risk review</p>
              {app.riskReview ? (
                <div className="flex flex-col gap-1.5 text-[13px] text-text-body">
                  <p>Score: {app.riskReview.riskScore ?? '—'}</p>
                  <p>Level: {app.riskReview.riskLevel ?? '—'}</p>
                  <p>Status: {app.riskReview.status}</p>
                  <p>Duplicate flag: {app.riskReview.duplicateFlag ? 'Yes' : 'No'}</p>
                  <p>Blacklist flag: {app.riskReview.blacklistFlag ? 'Yes' : 'No'}</p>
                </div>
              ) : (
                <p className="text-[13px] text-text-muted">Risk review pending.</p>
              )}
              {canApprove && app.status === 'PENDING_RISK_REVIEW' && (
                <button
                  onClick={() => run('Risk approved', () => approveRisk(token, id, { riskScore: 25, riskLevel: 'LOW' }))}
                  className="mt-3 rounded-[9px] bg-button-primary px-4 py-[9px] text-[13px] font-medium text-white hover:bg-button-primary-hover"
                >
                  Approve risk
                </button>
              )}
            </div>
          )}

          {activeTab === 'tips' && (
            <div className="rounded-[14px] border border-border-default bg-surface p-[22px]">
              <p className="mb-3 text-[13px] font-semibold text-text-primary">TIPS registration</p>
              {(app.merchant.integrations ?? [])
                .filter((i) => i.integrationType === 'TPS')
                .map((i) => (
                  <div key={i.integrationType} className="flex flex-col gap-1 rounded-[10px] border border-border-default p-3.5 text-[13px]">
                    <p className="text-text-body">Status: {i.status}</p>
                    <p className="font-mono text-text-muted">TIPS ID: {i.externalReferenceId ?? '—'}</p>
                    {i.failureReason && <p className="text-danger-text">{i.failureReason}</p>}
                  </div>
                ))}
              {(app.merchant.integrations ?? []).filter((i) => i.integrationType === 'TPS').length === 0 && (
                <p className="text-[13px] text-text-muted">TIPS registration has not started yet.</p>
              )}
              {canWrite && ['BANK_VALIDATED', 'PENDING_TPS_REGISTRATION', 'TPS_REGISTRATION_FAILED'].includes(app.status) && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => run('TIPS registration', () => registerTips(token, id))}
                    className="rounded-[9px] bg-button-primary px-4 py-[9px] text-[13px] font-medium text-white hover:bg-button-primary-hover"
                  >
                    Register TIPS
                  </button>
                  {app.status === 'TPS_REGISTRATION_FAILED' && (
                    <button
                      onClick={() => run('TIPS retry', () => retryTips(token, id))}
                      className="rounded-[9px] border border-border-input px-4 py-[9px] text-[13px] text-text-body hover:border-[#c9c9c3]"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'store' && (
            <OnboardingStoreQrPanel
              app={app}
              token={token}
              canWrite={!!canWrite}
              onRegister={() => void run('Alias/QR registration', () => registerAliasQr(token, id))}
              onRetry={() => void run('Alias/QR retry', () => retryAliasQr(token, id))}
            />
          )}

          {activeTab === 'settlement' && (
            <div className="rounded-[14px] border border-border-default bg-surface p-[22px]">
              <p className="mb-3 text-[13px] font-semibold text-text-primary">Settlement configuration</p>
              {app.merchant.settlementConfig && (
                <div className="mb-4 flex flex-col gap-1 text-[13px] text-text-body">
                  <p>Payout: {app.merchant.settlementConfig.payoutCycle}</p>
                  <p>MDR: {app.merchant.settlementConfig.mdr}</p>
                  <p>Approval: {app.merchant.settlementConfig.approvalStatus}</p>
                </div>
              )}
              {canWrite && ['ALIAS_QR_REGISTERED', 'PENDING_SETTLEMENT_SETUP', 'SETTLEMENT_REJECTED'].includes(app.status) && (
                <div className="flex max-w-md flex-col gap-3">
                  <SimpleField
                    label="Settlement alias"
                    value={settlement.settlementAlias}
                    onChange={(v) => setSettlement({ ...settlement, settlementAlias: v })}
                  />
                  <SimpleField
                    label="Payout cycle"
                    value={settlement.payoutCycle}
                    onChange={(v) => setSettlement({ ...settlement, payoutCycle: v })}
                  />
                  <SimpleField label="MDR" value={settlement.mdr} onChange={(v) => setSettlement({ ...settlement, mdr: v })} />
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        run('Settlement saved', () =>
                          saveSettlement(token, id, {
                            settlementAlias: settlement.settlementAlias,
                            payoutCycle: settlement.payoutCycle,
                            mdr: parseFloat(settlement.mdr),
                            dailyLimit: parseFloat(settlement.dailyLimit),
                          }),
                        )
                      }
                      className="rounded-[9px] bg-button-primary px-4 py-[9px] text-[13px] font-medium text-white hover:bg-button-primary-hover"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => run('Settlement submitted', () => saveSettlement(token, id, settlement))}
                      className="rounded-[9px] border border-border-input px-4 py-[9px] text-[13px] text-text-body hover:border-[#c9c9c3]"
                    >
                      Submit for approval
                    </button>
                  </div>
                </div>
              )}
              {canApprove && app.status === 'SETTLEMENT_APPROVAL_PENDING' && (
                <button
                  onClick={() => run('Settlement approved', () => approveSettlement(token, id))}
                  className="rounded-[9px] bg-button-primary px-4 py-[9px] text-[13px] font-medium text-white hover:bg-button-primary-hover"
                >
                  Approve settlement
                </button>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="rounded-[14px] border border-border-default bg-surface p-[22px]">
              <p className="mb-3 text-[13px] font-semibold text-text-primary">Timeline</p>
              <div className="flex flex-col">
                {(timelineQuery.data?.events ?? []).map((ev, i, arr) => (
                  <div
                    key={i}
                    className={cn('flex justify-between py-2 text-[13px]', i !== arr.length - 1 && 'border-b border-border-row')}
                  >
                    <span className="text-text-body">{ev.type.replace(/_/g, ' ')}</span>
                    <span className="text-text-muted">{new Date(ev.at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="rounded-[14px] border border-border-default bg-surface p-[22px]">
              <p className="mb-3 text-[13px] font-semibold text-text-primary">Audit log</p>
              <div className="flex flex-col gap-2">
                {(auditQuery.data ?? []).map((log) => (
                  <div key={log.id} className="rounded-[10px] border border-border-default p-3.5 text-[13px]">
                    <p className="font-medium text-text-primary">{formatAuditAction(log.action)}</p>
                    <p className="mt-0.5 text-text-muted">
                      {log.oldStatus ? formatOnboardingStatus(log.oldStatus) : '—'} →{' '}
                      {log.newStatus ? formatOnboardingStatus(log.newStatus) : '—'} ·{' '}
                      {new Date(log.performedAt).toLocaleString()}
                    </p>
                    {log.remarks && <p className="mt-1 text-text-body">{log.remarks}</p>}
                  </div>
                ))}
                {(auditQuery.data ?? []).length === 0 && <p className="text-[12.5px] text-text-muted">No audit entries yet.</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          {pendingTask && (
            <DecisionPanel
              token={token}
              taskId={pendingTask.id}
              applicationId={id}
              tradingName={app.merchant.tradingName}
              isMaker={isMaker}
              canApproveTask={!!canApproveTask}
              canRejectTask={!!canRejectTask}
              onDecided={refresh}
            />
          )}

          {pendingTask && canRejectTask && !isMaker && (
            <div className="rounded-[14px] border border-border-default bg-surface p-5">
              <p className="mb-2.5 text-[13px] font-semibold text-text-primary">Rejection reason codes</p>
              <div className="flex flex-col gap-1.5 text-[12.5px] text-text-body">
                {ONBOARDING_REJECTION_CODES.map((rc) => (
                  <div key={rc.code} className="flex gap-2">
                    <span className="font-mono text-text-muted">{rc.code}</span>
                    {rc.label}
                  </div>
                ))}
              </div>
              <p className="mt-2.5 border-t border-border-hairline pt-2.5 text-[12px] leading-[1.5] text-text-muted">
                The reason code determines which step the application reopens at for the applicant.
              </p>
            </div>
          )}

          <div className="rounded-[14px] border border-border-default bg-surface p-5">
            <p className="mb-2.5 text-[13px] font-semibold text-text-primary">Onboarding steps</p>
            <div className="flex flex-col">
              {ONBOARDING_WIZARD_STEPS.map((step, i, arr) => {
                const record = app.steps.find((s) => s.stepCode === step.code);
                const done = !!record?.completedAt;
                const active = app.currentStep === step.code;
                return (
                  <div
                    key={step.code}
                    className={cn('flex items-center gap-2.5 py-[7px] text-[12.5px]', i !== arr.length - 1 && 'border-b border-border-row')}
                  >
                    <span
                      className={cn(
                        'flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full text-[9px] text-white',
                        done ? 'bg-success-strong' : active ? 'bg-accent' : 'border border-border-input bg-surface',
                      )}
                    >
                      {done ? '✓' : ''}
                    </span>
                    <span className={done || active ? 'text-text-primary' : 'text-text-muted'}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimpleField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] text-text-body">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[9px] border border-border-input bg-surface px-3 py-[10px] text-[13.5px] text-text-primary outline-none focus:border-accent"
      />
    </div>
  );
}

function DecisionPanel({
  token,
  taskId,
  applicationId,
  tradingName,
  isMaker,
  canApproveTask,
  canRejectTask,
  onDecided,
}: {
  token: string;
  taskId: string;
  applicationId: string;
  tradingName: string;
  isMaker: boolean;
  canApproveTask: boolean;
  canRejectTask: boolean;
  onDecided: () => Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const [mode, setMode] = useState<'idle' | 'reject' | 'return'>('idle');
  const [rejectCode, setRejectCode] = useState(ONBOARDING_REJECTION_CODES[0]?.code ?? 'OTHER');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (isMaker) {
    return (
      <div className="rounded-[14px] border border-border-default bg-surface p-5">
        <p className="text-[13px] font-semibold text-text-primary">Decision</p>
        <p className="mt-2 text-[12.5px] text-text-muted">
          You submitted this application to the checker queue — you cannot approve or reject it yourself.
        </p>
      </div>
    );
  }

  async function handleApprove() {
    setBusy(true);
    setLocalError(null);
    try {
      await approveTask(token, taskId, comment.trim() || undefined);
      await onDecided();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!remarks.trim()) {
      setLocalError('Remarks are required to reject.');
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await rejectTask(token, taskId, `${rejectCode}: ${remarks.trim()}`);
      await onDecided();
      setMode('idle');
      setRemarks('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border-default bg-surface p-5">
      <p className="mb-3 text-[13px] font-semibold text-text-primary">Decision</p>

      {mode === 'idle' && (
        <div className="flex flex-col gap-2.5">
          {canApproveTask && (
            <>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Optional comment for the record…"
                className="rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
              />
              <button
                disabled={busy}
                onClick={() => void handleApprove()}
                className="flex items-center justify-center gap-2 rounded-[10px] bg-button-primary px-4 py-3 text-[13.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Approve — issue alias &amp; QR
              </button>
            </>
          )}
          {canRejectTask && (
            <button
              onClick={() => setMode('reject')}
              className="rounded-[10px] border border-border-input px-4 py-3 text-[13.5px] text-text-body hover:border-[#c9c9c3]"
            >
              Reject with reason code
            </button>
          )}
          <button
            onClick={() => setMode('return')}
            className="rounded-[10px] border border-border-default px-4 py-3 text-[13.5px] text-text-body hover:border-[#c9c9c3]"
          >
            Return for correction
          </button>
        </div>
      )}

      {mode === 'reject' && (
        <div className="flex flex-col gap-2.5">
          <select
            value={rejectCode}
            onChange={(e) => setRejectCode(e.target.value)}
            className="rounded-[9px] border border-border-input bg-surface px-3 py-[9px] text-[12.5px] text-text-primary outline-none focus:border-accent"
          >
            {ONBOARDING_REJECTION_CODES.map((rc) => (
              <option key={rc.code} value={rc.code}>
                {rc.code} — {rc.label}
              </option>
            ))}
          </select>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            placeholder={`Describe the issue for ${tradingName}…`}
            className="rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => void handleReject()}
              className="flex-1 rounded-[9px] border border-danger px-4 py-[9px] text-[13px] font-medium text-danger-text hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Rejecting…' : 'Confirm rejection'}
            </button>
            <button
              onClick={() => {
                setMode('idle');
                setLocalError(null);
              }}
              className="rounded-[9px] border border-border-input px-4 py-[9px] text-[13px] text-text-body hover:border-[#c9c9c3]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'return' && (
        <ReturnForCorrectionForm
          tradingName={tradingName}
          busy={busy}
          onCancel={() => {
            setMode('idle');
            setLocalError(null);
          }}
          onSubmit={async (text) => {
            setBusy(true);
            setLocalError(null);
            try {
              // Return-for-correction operates on the application directly
              // (sendBackOnboarding), not through the maker-checker task —
              // it re-opens editing for the applicant rather than recording
              // a checker decision on the task itself.
              await sendBackOnboarding(token, applicationId, text);
              await onDecided();
              setMode('idle');
            } catch (err) {
              setLocalError(err instanceof Error ? err.message : 'Failed to return for correction');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {localError && <p className="mt-2.5 text-[12.5px] text-danger-text">{localError}</p>}

      <p className="mt-3 border-t border-border-hairline pt-3 text-[12px] leading-[1.5] text-text-muted">
        The checker cannot be the maker. Sole Proprietor applications need one checker; Company applications
        escalate to a senior checker.
      </p>
    </div>
  );
}

function ReturnForCorrectionForm({
  tradingName,
  busy,
  onCancel,
  onSubmit,
}: {
  tradingName: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <div className="flex flex-col gap-2.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={`What should ${tradingName} correct before resubmitting?`}
        className="rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <button
          disabled={busy || !text.trim()}
          onClick={() => onSubmit(text.trim())}
          className="flex-1 rounded-[9px] border border-border-input px-4 py-[9px] text-[13px] font-medium text-text-primary hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send back'}
        </button>
        <button onClick={onCancel} className="rounded-[9px] border border-border-input px-4 py-[9px] text-[13px] text-text-body hover:border-[#c9c9c3]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function WorkflowActions({
  app,
  canWrite,
  canSubmit,
  canApprove,
  canReject,
  token,
  id,
  run,
  onGoToSettlement,
}: {
  app: OnboardingApplication;
  canWrite: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  token: string;
  id: string;
  run: (label: string, fn: () => Promise<unknown>) => Promise<void>;
  onGoToSettlement: () => void;
}) {
  const { status } = app;
  const entity = app.merchant.isSchool ? 'School' : 'Merchant';

  type RejectKind = 'reject' | 'sendBack' | 'rejectKyc';
  const [rejectKind, setRejectKind] = useState<RejectKind | null>(null);
  const [rejectCode, setRejectCode] = useState(ONBOARDING_REJECTION_CODES[0]?.code ?? 'OTHER');
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    label: string;
    description: string;
    fn: (comment?: string) => Promise<unknown>;
  } | null>(null);
  const [confirmComment, setConfirmComment] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  async function handleRejectConfirm() {
    setModalLoading(true);
    if (rejectKind === 'reject') {
      await run('Reject', () => rejectOnboarding(token, id, rejectCode, rejectRemarks));
    } else if (rejectKind === 'sendBack') {
      await run('Send back', () => sendBackOnboarding(token, id, rejectRemarks));
    } else if (rejectKind === 'rejectKyc') {
      await run('KYC rejected', () => rejectKyc(token, id, rejectRemarks, rejectCode));
    }
    setModalLoading(false);
    setRejectKind(null);
    setRejectRemarks('');
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    setModalLoading(true);
    await run(confirmAction.label, () => confirmAction.fn(confirmComment.trim() || undefined));
    setModalLoading(false);
    setConfirmAction(null);
    setConfirmComment('');
  }

  const actions: React.ReactNode[] = [];
  const primaryBtn = 'rounded-[9px] bg-button-primary px-4 py-[9px] text-[13px] font-medium text-white hover:bg-button-primary-hover';
  const outlineBtn = 'rounded-[9px] border border-border-input px-4 py-[9px] text-[13px] text-text-body hover:border-[#c9c9c3]';
  const dangerBtn = 'rounded-[9px] border border-danger px-4 py-[9px] text-[13px] font-medium text-danger-text hover:bg-danger-bg';

  if (canSubmit && ['DRAFT', 'REJECTED', 'KYC_REJECTED', 'RISK_REJECTED'].includes(status)) {
    actions.push(
      <button key="submit" className={primaryBtn} onClick={() => run('Submit', () => submitOnboarding(token, id))}>
        Submit for approval
      </button>,
    );
  }
  if (canWrite && ['REJECTED', 'KYC_REJECTED', 'RISK_REJECTED'].includes(status)) {
    actions.push(
      <button key="resubmit" className={outlineBtn} onClick={() => run('Resubmit', () => resubmitOnboarding(token, id))}>
        Resubmit
      </button>,
    );
  }
  if (canApprove && status === 'SUBMITTED') {
    actions.push(
      <button
        key="forward"
        className={primaryBtn}
        onClick={() =>
          setConfirmAction({
            label: 'Forwarded to checker',
            description: `Creates a checker-inbox task for ${app.merchant.tradingName}. A second user must approve it before the application advances.`,
            fn: () => makerApproveOnboarding(token, id),
          })
        }
      >
        Forward to checker
      </button>,
    );
  }
  if (canApprove && status === 'PENDING_KYC_APPROVAL') {
    actions.push(
      <button
        key="approve-kyc"
        className={outlineBtn}
        onClick={() =>
          setConfirmAction({
            label: 'KYC approved',
            description: `Marks the KYC documents for ${app.merchant.tradingName} as verified.`,
            fn: (comment) => approveKyc(token, id, comment),
          })
        }
      >
        Approve KYC
      </button>,
    );
  }
  if (canApprove && status === 'PENDING_RISK_REVIEW') {
    actions.push(
      <button
        key="approve-risk"
        className={primaryBtn}
        onClick={() =>
          setConfirmAction({
            label: 'Risk approved',
            description: `Approves the risk assessment for ${app.merchant.tradingName} and advances the application.`,
            fn: () => approveRisk(token, id, { riskScore: 25, riskLevel: 'LOW' }),
          })
        }
      >
        Approve risk
      </button>,
    );
  }
  if (canWrite && ['PENDING_BANK_VALIDATION', 'BANK_VALIDATION_FAILED'].includes(status)) {
    actions.push(
      <button key="verify-bank" className={primaryBtn} onClick={() => run('Bank verification', () => verifySettlement(token, id))}>
        Verify bank account
      </button>,
    );
  }
  if (canWrite && ['BANK_VALIDATED', 'PENDING_TPS_REGISTRATION', 'TPS_REGISTRATION_FAILED'].includes(status)) {
    actions.push(
      <button key="tips" className={primaryBtn} onClick={() => run('TIPS registration', () => registerTips(token, id))}>
        {status === 'TPS_REGISTRATION_FAILED' ? 'Retry TIPS registration' : 'Register TIPS'}
      </button>,
    );
  }
  if (canWrite && ['TPS_REGISTERED', 'ALIAS_QR_FAILED'].includes(status)) {
    actions.push(
      <button
        key="alias-qr"
        className={primaryBtn}
        onClick={() =>
          run('Alias/QR registration', () => (status === 'ALIAS_QR_FAILED' ? retryAliasQr(token, id) : registerAliasQr(token, id)))
        }
      >
        {status === 'ALIAS_QR_FAILED' ? 'Retry alias / QR' : 'Register alias / QR'}
      </button>,
    );
  }
  if (canWrite && status === 'ALIAS_QR_REGISTERED') {
    actions.push(
      <button key="config-settlement" className={primaryBtn} onClick={onGoToSettlement}>
        Configure settlement
      </button>,
    );
  }
  if (canApprove && status === 'SETTLEMENT_APPROVAL_PENDING') {
    actions.push(
      <button
        key="approve-settlement"
        className={primaryBtn}
        onClick={() =>
          setConfirmAction({
            label: 'Settlement approved',
            description: `Approves the settlement terms for ${app.merchant.tradingName}.`,
            fn: (comment) => approveSettlement(token, id, comment),
          })
        }
      >
        Approve settlement
      </button>,
    );
  }
  if (canApprove && ['READY_FOR_ACTIVATION', 'SETTLEMENT_APPROVED'].includes(status)) {
    actions.push(
      <button
        key="activate"
        className={primaryBtn}
        onClick={() =>
          setConfirmAction({
            label: `Activate ${entity}`,
            description: `Activates ${app.merchant.tradingName}'s live TANQR account. The ${entity.toLowerCase()} will immediately be able to accept payments. Continue?`,
            fn: () => activateOnboarding(token, id),
          })
        }
      >
        Activate {entity}
      </button>,
    );
  }
  if (status === 'ACTIVE' && app.merchantId) {
    actions.push(
      <Link key="view-merchant" href={`/merchants/${app.merchantId}`} className={primaryBtn}>
        View {entity} profile
      </Link>,
    );
  }
  if (canReject && !['ACTIVE', 'REJECTED', 'DRAFT'].includes(status)) {
    if (['SUBMITTED', 'UNDER_REVIEW', 'PENDING_KYC_APPROVAL'].includes(status)) {
      actions.push(
        <button key="send-back" className={outlineBtn} onClick={() => setRejectKind('sendBack')}>
          Send back
        </button>,
      );
    }
    if (['PENDING_KYC_APPROVAL', 'UNDER_REVIEW'].includes(status)) {
      actions.push(
        <button key="reject-kyc" className={outlineBtn} onClick={() => setRejectKind('rejectKyc')}>
          Reject KYC
        </button>,
      );
    }
    actions.push(
      <button key="reject" className={dangerBtn} onClick={() => setRejectKind('reject')}>
        Reject
      </button>,
    );
  }

  if (actions.length === 0 && rejectKind === null) return null;

  return (
    <div className="rounded-[14px] border border-border-default bg-surface p-5">
      {actions.length > 0 && <div className="flex flex-wrap gap-2">{actions}</div>}

      {rejectKind !== null && (
        <div className="mt-4 flex flex-col gap-2.5 border-t border-border-hairline pt-4">
          <p className="text-[13px] font-semibold text-text-primary">
            {rejectKind === 'sendBack' ? 'Send back to applicant' : rejectKind === 'rejectKyc' ? 'Reject KYC documents' : 'Reject application'}
          </p>
          {rejectKind !== 'sendBack' && (
            <select
              value={rejectCode}
              onChange={(e) => setRejectCode(e.target.value)}
              className="rounded-[9px] border border-border-input bg-surface px-3 py-[9px] text-[12.5px] text-text-primary outline-none focus:border-accent"
            >
              {ONBOARDING_REJECTION_CODES.map((rc) => (
                <option key={rc.code} value={rc.code}>
                  {rc.code} — {rc.label}
                </option>
              ))}
            </select>
          )}
          <textarea
            value={rejectRemarks}
            onChange={(e) => setRejectRemarks(e.target.value)}
            rows={3}
            placeholder={rejectKind === 'sendBack' ? 'Instructions for the applicant…' : 'Remarks…'}
            className="rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              disabled={modalLoading || !rejectRemarks.trim()}
              onClick={() => void handleRejectConfirm()}
              className={cn(dangerBtn, 'disabled:cursor-not-allowed disabled:opacity-50')}
            >
              {modalLoading ? 'Submitting…' : 'Confirm'}
            </button>
            <button onClick={() => setRejectKind(null)} className={outlineBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="mt-4 flex flex-col gap-2.5 border-t border-border-hairline pt-4">
          <p className="text-[13px] font-semibold text-text-primary">{confirmAction.label}</p>
          <p className="text-[12.5px] text-text-muted">{confirmAction.description}</p>
          <textarea
            value={confirmComment}
            onChange={(e) => setConfirmComment(e.target.value)}
            rows={2}
            placeholder="Comment (optional)…"
            className="rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button disabled={modalLoading} className={cn(primaryBtn, 'disabled:cursor-not-allowed disabled:opacity-50')} onClick={() => void handleConfirmAction()}>
              {modalLoading ? 'Processing…' : confirmAction.label}
            </button>
            <button onClick={() => setConfirmAction(null)} className={outlineBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
