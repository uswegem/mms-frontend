'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import {
  getKycUpgradeStatus,
  KYC_UPGRADE_DOC_TYPES,
  startKycUpgrade,
  submitKycUpgrade,
  uploadKycUpgradeDocumentFile,
  verifyKycUpgradeTin,
  type KycUpgradeRequest,
} from '@/lib/kyc-upgrade-api';
import { formatCurrency } from '@/lib/format';

export default function MerchantKycUpgradePage() {
  const { accessToken, user } = useAuth();
  const token = accessToken ?? '';
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const canWrite = user?.permissions?.includes('merchant:kyc:write');

  const statusQuery = useQuery({
    queryKey: ['kyc-upgrade-status'],
    queryFn: () => getKycUpgradeStatus(token),
    enabled: !!accessToken,
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['kyc-upgrade-status'] });
  }

  async function run<T>(label: string, fn: () => Promise<T>) {
    setError(null);
    try {
      const result = await fn();
      await refresh();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
      return null;
    }
  }

  if (statusQuery.isLoading || !statusQuery.data) {
    return <p className="py-20 text-center text-[13px] text-text-muted">Loading…</p>;
  }

  const status = statusQuery.data;
  const request = status.activeRequest;

  if (status.currentTier !== 'TIER_1' && !request) {
    return (
      <div className="-m-6 flex flex-col items-center gap-2 p-[26px_34px_34px] py-20 text-center">
        <CheckCircle2 className="h-8 w-8 text-success-text" />
        <p className="text-[15px] font-semibold text-text-primary">
          Already on {status.currentTier.replace('_', ' ')}
        </p>
        <p className="text-[13px] text-text-muted">No KYC tier upgrade is needed right now.</p>
      </div>
    );
  }

  return (
    <div className="-m-6 grid grid-cols-[1.25fr_1fr] items-start gap-5 p-[26px_34px_34px]">
      <div className="flex flex-col gap-5 rounded-[14px] border border-warning-border bg-surface p-[26px]">
        <div className="flex items-start gap-3">
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-warning text-[16px] text-white">
            !
          </div>
          <div>
            <p className="text-[19px] font-semibold text-text-primary">
              {status.breached ? 'Full KYC required to keep selling' : 'Lighter online-seller tier'}
            </p>
            <p className="mt-[3px] text-[13px] text-text-muted">
              {status.breached
                ? 'You have crossed the agreed threshold for the lighter online-seller tier.'
                : 'You are within your current threshold — no action required yet.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Rolling 30-day volume">
            {formatCurrency(status.rollingVolume, 'TZS', true)}
          </StatCard>
          <StatCard label="Tier threshold">{formatCurrency(status.tierThreshold, 'TZS', true)}</StatCard>
          <StatCard label="QR generation" warn={status.breached}>
            {status.breached ? 'Blocked until upgrade' : 'Available'}
          </StatCard>
        </div>

        {error && <p className="text-[12.5px] text-danger-text">{error}</p>}

        {!request && (
          <>
            <ChecklistCard />
            {canWrite && (
              <div className="flex gap-2.5">
                <button
                  onClick={() => void run('Start KYC upgrade', () => startKycUpgrade(token))}
                  className="rounded-[10px] bg-button-primary px-5 py-3 text-[13.5px] font-medium text-white hover:bg-button-primary-hover"
                >
                  Start KYC upgrade
                </button>
              </div>
            )}
          </>
        )}

        {request && request.status === 'IN_PROGRESS' && (
          <UpgradeInProgress token={token} request={request} onChange={refresh} setError={setError} />
        )}

        {request && request.status === 'PENDING_CHECKER_APPROVAL' && (
          <div className="rounded-[12px] border border-border-default bg-page p-4">
            <p className="text-[13px] font-semibold text-text-primary">Awaiting checker approval</p>
            <p className="mt-1.5 text-[12.5px] text-text-muted">
              Your TIN was verified and documents attached — this request is now with LFB back
              office for a fresh maker-checker review.
            </p>
          </div>
        )}

        {request && request.status === 'REJECTED' && (
          <div className="rounded-[12px] border border-danger bg-danger-bg p-4">
            <p className="text-[13px] font-semibold text-danger-text">Upgrade rejected</p>
            {request.rejectionNotes && (
              <p className="mt-1.5 text-[12.5px] text-text-body">{request.rejectionNotes}</p>
            )}
            {canWrite && (
              <button
                onClick={() => void run('Start KYC upgrade', () => startKycUpgrade(token))}
                className="mt-3 rounded-[9px] bg-button-primary px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-button-primary-hover"
              >
                Start a new request
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="rounded-[14px] border border-border-default bg-surface p-5">
          <p className="text-[13px] font-semibold text-text-primary">Why this exists</p>
          <p className="mt-2 text-[12.5px] leading-[1.55] text-text-muted">
            The lighter path — NIDA plus phone OTP, no TIN and no business registration —
            deviates from the BRS baseline for merchant onboarding. It is admissible only with
            formal BOT sign-off and an agreed value threshold, above which the seller must move
            to full Sole Proprietor or Company KYC.
          </p>
        </div>
        <div className="rounded-[14px] border border-border-default bg-surface p-5">
          <p className="text-[13px] font-semibold text-text-primary">Status handling</p>
          <div className="mt-2.5 flex flex-col gap-2 text-[12.5px] text-text-body">
            <div className="flex justify-between">
              <span>Active</span>
              <span className="text-text-muted">≥1 transaction in 90 days</span>
            </div>
            <div className="flex justify-between">
              <span>Dormant</span>
              <span className="text-text-muted">no transaction &gt; 90 days</span>
            </div>
            <div className="flex justify-between">
              <span>Suspended</span>
              <span className="text-text-muted">disabled by the bank</span>
            </div>
          </div>
          <p className="mt-2.5 border-t border-border-hairline pt-2.5 text-[12px] leading-[1.5] text-text-muted">
            Active and Dormant are system-driven. Suspension requires maker-checker approval.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  warn,
  children,
}: {
  label: string;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[12px] border p-[14px] ${
        warn ? 'border-warning-border bg-warning-bg' : 'border-border-default'
      }`}
    >
      <p className={`text-[11.5px] ${warn ? 'text-warning-text' : 'text-text-muted'}`}>{label}</p>
      <p
        className={`mt-1 text-[15px] font-semibold tabular-nums ${
          warn ? 'text-warning-text' : 'text-text-primary'
        }`}
      >
        {children}
      </p>
    </div>
  );
}

function ChecklistCard() {
  const items = [
    { title: 'Step 3 — TIN verification against TRA', sub: 'Full real-time check, name match and active status' },
    { title: 'Step 4 — business registration documents', sub: 'Business licence or BRELA certificate, plus TIN certificate' },
    { title: 'Fresh maker-checker review', sub: 'Existing alias, QR codes and transaction history are retained' },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13px] font-semibold text-text-primary">What the upgrade adds</p>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <div key={item.title} className="flex gap-2.5">
            <div className="mt-[3px] h-[18px] w-[18px] flex-none rounded-[5px] border border-border-input" />
            <div>
              <p className="text-[13px] font-medium text-text-primary">{item.title}</p>
              <p className="mt-0.5 text-[12.5px] text-text-muted">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpgradeInProgress({
  token,
  request,
  onChange,
  setError,
}: {
  token: string;
  request: KycUpgradeRequest;
  onChange: () => Promise<void>;
  setError: (e: string | null) => void;
}) {
  const [tin, setTin] = useState('');
  const [docType, setDocType] = useState<string>(KYC_UPGRADE_DOC_TYPES[0].code);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setBusy(false);
    }
  }

  const tinVerified = request.tinVerificationResult === 'MATCH';
  const hasDocument = request.documents.length > 0;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await run('Attach document', () => uploadKycUpgradeDocumentFile(token, request.id, file, docType));
  }

  return (
    <div className="flex flex-col gap-3.5 border-t border-border-hairline pt-4">
      <div className="flex items-center gap-2">
        <StepDot done={tinVerified} />
        <p className="text-[13px] font-semibold text-text-primary">TIN verification</p>
      </div>
      {!tinVerified ? (
        <div className="flex gap-2 pl-6">
          <input
            value={tin}
            onChange={(e) => setTin(e.target.value)}
            placeholder="142880771"
            className="w-[180px] rounded-[9px] border border-border-input bg-surface px-3 py-2 font-mono text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
          <button
            disabled={!tin.trim() || busy}
            onClick={() => void run('Verify TIN', () => verifyKycUpgradeTin(token, request.id, tin.trim()))}
            className="rounded-[9px] bg-button-primary px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Verify with TRA'}
          </button>
        </div>
      ) : (
        <p className="pl-6 text-[12.5px] text-success-text">
          Verified — {request.tinVerifiedName}
        </p>
      )}

      <div className="flex items-center gap-2">
        <StepDot done={hasDocument} />
        <p className="text-[13px] font-semibold text-text-primary">Business registration document</p>
      </div>
      <div className="flex flex-col gap-2 pl-6">
        {request.documents.map((doc) => (
          <p key={doc.id} className="text-[12.5px] text-text-body">
            {doc.docType.replace(/_/g, ' ').toLowerCase()} — {doc.fileName}
          </p>
        ))}
        {!hasDocument && (
          <div className="flex gap-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
            >
              {KYC_UPGRADE_DOC_TYPES.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-[9px] border border-dashed border-border-input px-3.5 py-2 text-[12.5px] text-text-muted hover:border-[#c9c9c3] disabled:opacity-50"
            >
              + Attach
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => void handleFileChange(e)} />
          </div>
        )}
      </div>

      <button
        disabled={!tinVerified || !hasDocument || busy}
        onClick={() => void run('Submit for approval', () => submitKycUpgrade(token, request.id))}
        className="mt-1 flex items-center justify-center gap-2 self-start rounded-[10px] bg-button-primary px-5 py-2.5 text-[13px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Submit for checker review
      </button>
    </div>
  );
}

function StepDot({ done }: { done: boolean }) {
  return done ? (
    <CheckCircle2 className="h-4 w-4 text-success-text" />
  ) : (
    <AlertTriangle className="h-4 w-4 text-text-disabled" />
  );
}
