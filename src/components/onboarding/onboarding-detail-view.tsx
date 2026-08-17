'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OnboardingStepper } from '@/components/onboarding/onboarding-stepper';
import { OnboardingStoreQrPanel } from '@/components/onboarding/onboarding-store-qr-panel';
import { BankSelectField } from '@/components/onboarding/bank-select-field';
import { DEFAULT_BANK_SWIFT, formatBankDisplay } from '@/lib/tanzania-banks';
import {
  activateOnboarding,
  approveKyc,
  approveRisk,
  approveSettlement,
  assignSettlementAccount,
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
  formatOnboardingStep,
  formatAuditAction,
  type OnboardingApplication,
} from '@/lib/onboarding-api';
import { RejectModal, ONBOARDING_REJECTION_CODES } from '@/components/ui/reject-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';

export function OnboardingDetailView({ id }: { id: string }) {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('profile');
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

  const app = appQuery.data;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['onboarding', id] });
    await queryClient.invalidateQueries({ queryKey: ['onboarding-timeline', id] });
    await queryClient.invalidateQueries({ queryKey: ['onboarding-audit', id] });
    await queryClient.invalidateQueries({ queryKey: ['onboarding-dashboard'] });
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
    return <p className="py-20 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  const editable = ['DRAFT', 'KYC_REJECTED', 'RISK_REJECTED', 'REJECTED', 'PENDING_KYC_DOCUMENTS', 'PENDING_SETTLEMENT_SETUP', 'SETTLEMENT_REJECTED', 'BANK_VALIDATION_FAILED', 'TPS_REGISTRATION_FAILED', 'ALIAS_QR_FAILED'].includes(app.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/onboarding">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <PageHeader title={app.applicationNo} description={app.merchant.tradingName}>
          <Badge variant={statusBadgeVariant(app.status)}>{formatOnboardingStatus(app.status)}</Badge>
          {app.merchant.merchantCode && (
            <Badge variant="outline">{app.merchant.merchantCode}</Badge>
          )}
        </PageHeader>
      </div>

      <OnboardingStepper steps={app.steps} currentStep={app.currentStep} status={app.status} />

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess(null)}>{success}</Alert>}

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="bank">Bank</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="tips">TIPS</TabsTrigger>
          <TabsTrigger value="store">Store / QR</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle className="text-base">Business Details</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2">
              <p><strong>Legal Name:</strong> {app.merchant.legalName}</p>
              <p><strong>Trading Name:</strong> {app.merchant.tradingName}</p>
              <p><strong>Type:</strong> {app.legalEntityType}</p>
              <p><strong>MCC:</strong> {app.merchant.mcc}</p>
              <p><strong>TIN:</strong> {app.merchant.taxId ?? '—'}</p>
              <p><strong>VRN:</strong> {app.merchant.vrn ?? '—'}</p>
              <p><strong>License No:</strong> {app.merchant.licenseNumber ?? '—'}</p>
              <p><strong>Email:</strong> {app.merchant.profile?.contactEmail ?? '—'}</p>
              <p><strong>Mobile:</strong> {app.merchant.profile?.contactPhone ?? '—'}</p>
              <p><strong>Region:</strong> {app.merchant.profile?.region ?? '—'}</p>
              <p><strong>City:</strong> {app.merchant.profile?.city ?? '—'}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc">
          <Card>
            <CardHeader><CardTitle className="text-base">KYC Documents</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canWrite && editable && (
                <>
                  <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void run('Document upload', () => uploadOnboardingKycFile(token, id, file, 'KYC_ID'));
                  }} />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    Upload KYC ID
                  </Button>
                </>
              )}
              <ul className="space-y-2 text-sm">
                {(app.merchant.documents ?? []).map((d) => (
                  <li key={d.id} className="flex justify-between rounded border border-border px-3 py-2">
                    <span>{d.docType} — {d.fileName}</span>
                    <Badge variant={d.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>
                      {d.verificationStatus}
                    </Badge>
                  </li>
                ))}
                {(app.merchant.documents ?? []).length === 0 && (
                  <p className="text-muted-foreground">No documents uploaded yet.</p>
                )}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank">
          <Card>
            <CardHeader><CardTitle className="text-base">Settlement Bank Account</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {app.merchant.settlementAccount ? (
                <div className="text-sm space-y-1">
                  <p><strong>Bank:</strong> {formatBankDisplay(app.merchant.settlementAccount.bankCode)}</p>
                  <p>{app.merchant.settlementAccount.accountName}</p>
                  <p className="font-mono">{app.merchant.settlementAccount.accountNumber}</p>
                  <p className="text-muted-foreground">
                    {app.merchant.settlementAccount.verifiedAt ? 'CBS Verified' : 'Pending verification'}
                  </p>
                  {canWrite && (
                    <Button size="sm" variant="outline" onClick={() => run('Bank validation', () => verifySettlement(token, id))}>
                      Verify Account
                    </Button>
                  )}
                </div>
              ) : canWrite && editable ? (
                <div className="space-y-2 max-w-md">
                  <Label>Account Number</Label>
                  <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                  <Label>Account Name</Label>
                  <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                  <BankSelectField value={bankCode} onChange={setBankCode} />
                  <Button size="sm" onClick={() => run('Settlement assigned', () =>
                    assignSettlementAccount(token, id, { accountNumber, accountName, bankCode }),
                  )}>
                    Assign Account
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No settlement account assigned.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <CardHeader><CardTitle className="text-base">Risk Review</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {app.riskReview ? (
                <>
                  <p><strong>Score:</strong> {app.riskReview.riskScore ?? '—'}</p>
                  <p><strong>Level:</strong> {app.riskReview.riskLevel ?? '—'}</p>
                  <p><strong>Status:</strong> {app.riskReview.status}</p>
                  <p><strong>Duplicate:</strong> {app.riskReview.duplicateFlag ? 'Yes' : 'No'}</p>
                  <p><strong>Blacklist:</strong> {app.riskReview.blacklistFlag ? 'Yes' : 'No'}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Risk review pending.</p>
              )}
              {canApprove && app.status === 'PENDING_RISK_REVIEW' && (
                <Button size="sm" onClick={() => run('Risk approved', () => approveRisk(token, id, { riskScore: 25, riskLevel: 'LOW' }))}>
                  Approve Risk
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tips">
          <Card>
            <CardHeader><CardTitle className="text-base">TIPS Registration</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {(app.merchant.integrations ?? []).filter((i) => i.integrationType === 'TPS').map((i) => (
                <div key={i.integrationType} className="rounded border border-border p-3">
                  <p><strong>Status:</strong> {i.status}</p>
                  <p><strong>TIPS ID:</strong> {i.externalReferenceId ?? '—'}</p>
                  {i.failureReason && <p className="text-destructive">{i.failureReason}</p>}
                </div>
              ))}
              {(app.merchant.integrations ?? []).filter((i) => i.integrationType === 'TPS').length === 0 && (
                <p className="text-muted-foreground">TIPS registration has not been started yet.</p>
              )}
              {canWrite && ['BANK_VALIDATED', 'PENDING_TPS_REGISTRATION', 'TPS_REGISTRATION_FAILED'].includes(app.status) && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => run('TIPS registration', () => registerTips(token, id))}>Register TIPS</Button>
                  {app.status === 'TPS_REGISTRATION_FAILED' && (
                    <Button size="sm" variant="outline" onClick={() => run('TIPS retry', () => retryTips(token, id))}>Retry</Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="store">
          <OnboardingStoreQrPanel
            app={app}
            token={token}
            canWrite={!!canWrite}
            onRegister={() => void run('Alias/QR registration', () => registerAliasQr(token, id))}
            onRetry={() => void run('Alias/QR retry', () => retryAliasQr(token, id))}
          />
        </TabsContent>

        <TabsContent value="settlement">
          <Card>
            <CardHeader><CardTitle className="text-base">Settlement Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-md">
              {app.merchant.settlementConfig && (
                <div className="text-sm space-y-1 mb-4">
                  <p>Payout: {app.merchant.settlementConfig.payoutCycle}</p>
                  <p>MDR: {app.merchant.settlementConfig.mdr}</p>
                  <p>Approval: {app.merchant.settlementConfig.approvalStatus}</p>
                </div>
              )}
              {canWrite && ['ALIAS_QR_REGISTERED', 'PENDING_SETTLEMENT_SETUP', 'SETTLEMENT_REJECTED'].includes(app.status) && (
                <>
                  <Label>Settlement Alias</Label>
                  <Input value={settlement.settlementAlias} onChange={(e) => setSettlement({ ...settlement, settlementAlias: e.target.value })} />
                  <Label>Payout Cycle</Label>
                  <Input value={settlement.payoutCycle} onChange={(e) => setSettlement({ ...settlement, payoutCycle: e.target.value })} />
                  <Label>MDR</Label>
                  <Input value={settlement.mdr} onChange={(e) => setSettlement({ ...settlement, mdr: e.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => run('Settlement saved', () => saveSettlement(token, id, {
                      settlementAlias: settlement.settlementAlias,
                      payoutCycle: settlement.payoutCycle,
                      mdr: parseFloat(settlement.mdr),
                      dailyLimit: parseFloat(settlement.dailyLimit),
                    }))}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => run('Settlement submitted', () => saveSettlement(token, id, settlement))}>
                      Submit for Approval
                    </Button>
                  </div>
                </>
              )}
              {canApprove && app.status === 'SETTLEMENT_APPROVAL_PENDING' && (
                <Button size="sm" onClick={() => run('Settlement approved', () => approveSettlement(token, id))}>
                  Approve Settlement
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {timelineQuery.data?.events.map((ev, i) => (
                <div key={i} className="flex justify-between border-b border-border py-1">
                  <span>{ev.type}</span>
                  <span className="text-muted-foreground">{new Date(ev.at).toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader><CardTitle className="text-base">Audit Log</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {auditQuery.data?.map((log) => (
                <div key={log.id} className="rounded border border-border p-3">
                  <p className="font-medium">{formatAuditAction(log.action)}</p>
                  <p className="text-muted-foreground">
                    {log.oldStatus ? formatOnboardingStatus(log.oldStatus) : '—'} →{' '}
                    {log.newStatus ? formatOnboardingStatus(log.newStatus) : '—'} ·{' '}
                    {new Date(log.performedAt).toLocaleString()}
                  </p>
                  {log.remarks && <p>{log.remarks}</p>}
                </div>
              ))}
              {(auditQuery.data ?? []).length === 0 && (
                <p className="text-muted-foreground">No audit entries yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const STATUS_GUIDANCE: Partial<Record<string, string>> = {
  DRAFT: 'Complete the application and submit it for maker review.',
  SUBMITTED: 'Review the application and send it for checker approval.',
  UNDER_REVIEW: 'Waiting for checker to approve in the Checker Inbox.',
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
  const guidance = STATUS_GUIDANCE[status];

  // ── Modal state ────────────────────────────────────────────────────────────
  type RejectKind = 'reject' | 'sendBack' | 'rejectKyc';
  const [rejectKind, setRejectKind] = useState<RejectKind | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    label: string;
    description: string;
    fn: (comment?: string) => Promise<unknown>;
  } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  async function handleRejectConfirm(params: { code?: string; remarks: string }) {
    setModalLoading(true);
    if (rejectKind === 'reject') {
      await run('Reject', () =>
        rejectOnboarding(token, id, params.code ?? 'INCOMPLETE_KYC', params.remarks),
      );
    } else if (rejectKind === 'sendBack') {
      await run('Send back', () => sendBackOnboarding(token, id, params.remarks));
    } else if (rejectKind === 'rejectKyc') {
      await run('KYC rejected', () =>
        rejectKyc(token, id, params.remarks, params.code ?? 'INCOMPLETE_KYC'),
      );
    }
    setModalLoading(false);
    setRejectKind(null);
  }

  async function handleConfirmAction(comment?: string) {
    if (!confirmAction) return;
    setModalLoading(true);
    await run(confirmAction.label, () => confirmAction.fn(comment));
    setModalLoading(false);
    setConfirmAction(null);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next Step</CardTitle>
          {guidance && <p className="text-sm text-muted-foreground">{guidance}</p>}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">

          {/* ── Submit ── */}
          {canSubmit && ['DRAFT', 'REJECTED', 'KYC_REJECTED', 'RISK_REJECTED'].includes(status) && (
            <Button onClick={() => run('Submit', () => submitOnboarding(token, id))}>
              Submit for Approval
            </Button>
          )}
          {canWrite && ['REJECTED', 'KYC_REJECTED', 'RISK_REJECTED'].includes(status) && (
            <Button variant="outline" onClick={() => run('Resubmit', () => resubmitOnboarding(token, id))}>
              Resubmit
            </Button>
          )}

          {/* ── Maker forwards application to checker queue ── */}
          {canApprove && status === 'SUBMITTED' && (
            <div className="flex flex-col gap-0.5">
              <Button
                onClick={() =>
                  setConfirmAction({
                    label: 'Forwarded to checker',
                    description: `This creates a checker-inbox task for ${app.merchant.tradingName}. A second user must approve it before the application advances.`,
                    fn: () => makerApproveOnboarding(token, id),
                  })
                }
              >
                Forward to Checker
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Sends this application to the Checker Inbox for independent approval.
              </p>
            </div>
          )}

          {/* ── Checker inbox link ── */}
          {['UNDER_REVIEW', 'PENDING_KYC_APPROVAL'].includes(status) && (
            <Link href="/approvals">
              <Button>Go to Checker Inbox</Button>
            </Link>
          )}

          {/* ── KYC document approval (distinct from checker-inbox approval) ── */}
          {canApprove && status === 'PENDING_KYC_APPROVAL' && (
            <div className="flex flex-col gap-0.5">
              <Button
                variant="outline"
                onClick={() =>
                  setConfirmAction({
                    label: 'KYC approved',
                    description: `Marks the KYC documents for ${app.merchant.tradingName} as verified. This is a direct document review — separate from the checker-inbox flow.`,
                    fn: (comment) => approveKyc(token, id, comment),
                  })
                }
              >
                Approve KYC
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Verifies KYC documents directly — does not go through the Checker Inbox.
              </p>
            </div>
          )}

          {/* ── Risk approval ── */}
          {canApprove && status === 'PENDING_RISK_REVIEW' && (
            <Button
              onClick={() =>
                setConfirmAction({
                  label: 'Risk approved',
                  description: `Approves the risk assessment for ${app.merchant.tradingName} and advances the application.`,
                  fn: () => approveRisk(token, id, { riskScore: 25, riskLevel: 'LOW' }),
                })
              }
            >
              Approve Risk
            </Button>
          )}

          {/* ── Bank verification ── */}
          {canWrite && ['PENDING_BANK_VALIDATION', 'BANK_VALIDATION_FAILED'].includes(status) && (
            <Button onClick={() => run('Bank verification', () => verifySettlement(token, id))}>
              Verify Bank Account
            </Button>
          )}

          {/* ── TIPS registration ── */}
          {canWrite && ['BANK_VALIDATED', 'PENDING_TPS_REGISTRATION', 'TPS_REGISTRATION_FAILED'].includes(status) && (
            <Button onClick={() => run('TIPS registration', () => registerTips(token, id))}>
              {status === 'TPS_REGISTRATION_FAILED' ? 'Retry TIPS Registration' : 'Register TIPS'}
            </Button>
          )}

          {/* ── Alias / QR ── */}
          {canWrite && ['TPS_REGISTERED', 'ALIAS_QR_FAILED'].includes(status) && (
            <Button
              onClick={() =>
                run('Alias/QR registration', () =>
                  status === 'ALIAS_QR_FAILED' ? retryAliasQr(token, id) : registerAliasQr(token, id),
                )
              }
            >
              {status === 'ALIAS_QR_FAILED' ? 'Retry Alias / QR' : 'Register Alias / QR'}
            </Button>
          )}

          {/* ── Configure settlement ── */}
          {canWrite && status === 'ALIAS_QR_REGISTERED' && (
            <Button onClick={onGoToSettlement}>Configure Settlement</Button>
          )}

          {/* ── Settlement approval ── */}
          {canApprove && status === 'SETTLEMENT_APPROVAL_PENDING' && (
            <Button
              onClick={() =>
                setConfirmAction({
                  label: 'Settlement approved',
                  description: `Approves the settlement terms for ${app.merchant.tradingName}.`,
                  fn: (comment) => approveSettlement(token, id, comment),
                })
              }
            >
              Approve Settlement
            </Button>
          )}

          {/* ── Activate ── */}
          {canApprove && ['READY_FOR_ACTIVATION', 'SETTLEMENT_APPROVED'].includes(status) && (
            <Button
              onClick={() =>
                setConfirmAction({
                  label: `Activate ${entity}`,
                  description: `This activates ${app.merchant.tradingName}'s live TANQR account. The ${entity.toLowerCase()} will immediately be able to accept payments. Continue?`,
                  fn: () => activateOnboarding(token, id),
                })
              }
            >
              Activate {entity}
            </Button>
          )}

          {/* ── View live merchant ── */}
          {status === 'ACTIVE' && app.merchantId && (
            <Link href={`/merchants/${app.merchantId}`}>
              <Button>View {entity} Profile</Button>
            </Link>
          )}

          {/* ── Reject / send back ── */}
          {canReject && !['ACTIVE', 'REJECTED', 'DRAFT'].includes(status) && (
            <>
              {['SUBMITTED', 'UNDER_REVIEW', 'PENDING_KYC_APPROVAL'].includes(status) && (
                <Button variant="outline" onClick={() => setRejectKind('sendBack')}>
                  Send Back
                </Button>
              )}
              {['PENDING_KYC_APPROVAL', 'UNDER_REVIEW'].includes(status) && (
                <Button variant="outline" onClick={() => setRejectKind('rejectKyc')}>
                  Reject KYC
                </Button>
              )}
              <Button variant="destructive" onClick={() => setRejectKind('reject')}>
                Reject
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Reject / send-back modal ── */}
      <RejectModal
        open={rejectKind !== null}
        title={
          rejectKind === 'sendBack'
            ? 'Send Back to Applicant'
            : rejectKind === 'rejectKyc'
            ? 'Reject KYC Documents'
            : 'Reject Application'
        }
        description={
          rejectKind === 'sendBack'
            ? 'Explain what needs to be corrected before the applicant can resubmit.'
            : rejectKind === 'rejectKyc'
            ? 'Select a reason code and describe the KYC issue.'
            : 'This permanently rejects the application. The applicant will be notified with your reason.'
        }
        reasonCodes={rejectKind !== 'sendBack' ? ONBOARDING_REJECTION_CODES : undefined}
        remarksLabel={rejectKind === 'sendBack' ? 'Instructions for applicant' : 'Remarks'}
        onClose={() => setRejectKind(null)}
        onConfirm={handleRejectConfirm}
        loading={modalLoading}
      />

      {/* ── Approve confirmation modal ── */}
      <ConfirmModal
        open={confirmAction !== null}
        title={confirmAction?.label ?? ''}
        description={confirmAction?.description ?? ''}
        confirmLabel={confirmAction?.label ?? 'Confirm'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        loading={modalLoading}
      />
    </>
  );
}
