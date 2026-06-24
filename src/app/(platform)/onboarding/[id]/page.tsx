'use client';

import { use, useRef, useState } from 'react';
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
import {
  assignSettlementAccount,
  getOnboardingApplication,
  getOnboardingTimeline,
  makerApproveOnboarding,
  rejectOnboarding,
  resubmitOnboarding,
  submitOnboarding,
  uploadOnboardingKycFile,
} from '@/lib/onboarding-api';

export default function OnboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankCode, setBankCode] = useState('CRDB');

  const appQuery = useQuery({
    queryKey: ['onboarding', id],
    queryFn: () => getOnboardingApplication(accessToken!, id),
    enabled: !!accessToken,
  });

  const timelineQuery = useQuery({
    queryKey: ['onboarding-timeline', id],
    queryFn: () => getOnboardingTimeline(accessToken!, id),
    enabled: !!accessToken,
  });

  const app = appQuery.data;
  const token = accessToken!;

  const canWrite = user?.permissions?.includes('onboarding:write');
  const canSubmit = user?.permissions?.includes('onboarding:submit');
  const canApprove = user?.permissions?.includes('onboarding:approve');
  const canReject = user?.permissions?.includes('onboarding:reject');

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['onboarding', id] });
    await queryClient.invalidateQueries({ queryKey: ['onboarding-timeline', id] });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/onboarding">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <PageHeader title={app.applicationNo} description={app.merchant.tradingName}>
          <Badge variant={statusBadgeVariant(app.status)}>{app.status}</Badge>
        </PageHeader>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess(null)}>{success}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Profile & KYC</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p><strong>Legal:</strong> {app.merchant.legalName}</p>
            <p><strong>Type:</strong> {app.legalEntityType}</p>
            <p><strong>MCC:</strong> {app.merchant.mcc}</p>
            {canWrite && app.status === 'DRAFT' && (
              <>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void run('Document upload', () => uploadOnboardingKycFile(token, id, file, 'KYC_ID'));
                }} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Upload KYC Document
                </Button>
              </>
            )}
            <ul className="space-y-1">
              {app.steps.map((s) => (
                <li key={s.stepCode} className="flex justify-between">
                  <span>{s.stepCode}</span>
                  <span className="text-muted-foreground">{s.completedAt ? '✓' : '—'}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Settlement Account</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {app.merchant.settlementAccount ? (
              <div className="text-sm">
                <p>{app.merchant.settlementAccount.accountName}</p>
                <p className="font-mono">{app.merchant.settlementAccount.accountNumber}</p>
                <p className="text-muted-foreground">
                  {app.merchant.settlementAccount.verifiedAt ? 'CBS Verified' : 'Pending verification'}
                </p>
              </div>
            ) : canWrite && app.status === 'DRAFT' ? (
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                <Label>Account Name</Label>
                <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                <Label>Bank Code</Label>
                <Input value={bankCode} onChange={(e) => setBankCode(e.target.value)} />
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
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Workflow Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canSubmit && app.status === 'DRAFT' && (
            <Button onClick={() => run('Submit', () => submitOnboarding(token, id))}>
              Submit for Approval
            </Button>
          )}
          {canApprove && app.status === 'SUBMITTED' && (
            <Button onClick={() => run('Maker approve', () => makerApproveOnboarding(token, id))}>
              Maker Approve (Send to Checker)
            </Button>
          )}
          {canReject && ['SUBMITTED', 'UNDER_REVIEW'].includes(app.status) && (
            <Button variant="destructive" onClick={() => run('Reject', () =>
              rejectOnboarding(token, id, 'INCOMPLETE_KYC', 'Rejected by compliance'),
            )}>
              Reject
            </Button>
          )}
          {canWrite && app.status === 'REJECTED' && (
            <Button variant="outline" onClick={() => run('Resubmit', () => resubmitOnboarding(token, id))}>
              Resubmit (Back to Draft)
            </Button>
          )}
          {app.status === 'UNDER_REVIEW' && (
            <Link href="/approvals"><Button variant="outline">Go to Checker Inbox</Button></Link>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
