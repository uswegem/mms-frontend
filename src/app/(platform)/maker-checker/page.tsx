'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import {
  listApprovalPolicies,
  updateApprovalPolicy,
  type ApprovalEntityType,
  type ApprovalPolicy,
} from '@/lib/approvals-api';

const ACTIVITY_COPY: Record<ApprovalEntityType, { label: string; description: string; source: string }> = {
  MERCHANT_ONBOARDING: {
    label: 'Merchant approval',
    description: 'A new merchant or company application needs checker sign-off before it can be activated.',
    source: 'BRS baseline',
  },
  SCHOOL_ONBOARDING: {
    label: 'School approval',
    description: 'A new school onboarding application needs checker sign-off before it can be activated.',
    source: 'BRS baseline',
  },
  MERCHANT_STATUS_CHANGE: {
    label: 'Merchant status change',
    description: 'Suspending, reactivating or closing a live merchant needs checker sign-off.',
    source: 'BRS baseline',
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return 'Not yet changed from default';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MakerCheckerPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [savingType, setSavingType] = useState<ApprovalEntityType | null>(null);

  const canConfig = user?.permissions?.includes('config:write');

  const query = useQuery({
    queryKey: ['approval-policies'],
    queryFn: () => listApprovalPolicies(accessToken!),
    enabled: !!accessToken && !!canConfig,
  });

  if (!canConfig) {
    return <p className="py-20 text-center text-[13px] text-text-muted">No config:write permission.</p>;
  }

  const policies = query.data ?? [];

  async function save(policy: ApprovalPolicy, patch: { enabled?: boolean; slaHours?: number }) {
    setSavingType(policy.entityType);
    setError(null);
    try {
      await updateApprovalPolicy(accessToken!, policy.entityType, {
        enabled: patch.enabled ?? policy.enabled,
        slaHours: patch.slaHours ?? policy.slaHours,
      });
      setSuccess(`${ACTIVITY_COPY[policy.entityType].label} updated.`);
      setDrafts((d) => {
        const next = { ...d };
        delete next[policy.entityType];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['approval-policies'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update policy');
    } finally {
      setSavingType(null);
    }
  }

  return (
    <div className="-m-6 flex flex-col p-[26px_34px_34px]">
      <div className="mb-5 flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <p className="eyebrow">LFB back office · system configuration</p>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">Maker-checker activities</h1>
          <p className="mt-0.5 text-[13px] text-text-muted">Which functions require dual control, and at what level.</p>
        </div>
        <Link
          href="/fees"
          className="rounded-[9px] border border-border-default bg-surface px-[14px] py-[9px] text-[13px] text-text-body hover:border-[#c9c9c3]"
        >
          ← Fees &amp; MDR
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-[10px] border border-danger bg-danger-bg px-4 py-2.5 text-[13px] text-danger-text">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-[10px] border border-success-border bg-success-bg px-4 py-2.5 text-[13px] text-success-text">
          {success}
        </div>
      )}

      <div className="mb-6 overflow-hidden rounded-[14px] border border-border-default bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border-hairline text-[12px] font-medium text-text-muted">
                <th className="px-5 py-3 text-left font-medium">Activity</th>
                <th className="px-2 py-3 text-left font-medium">Dual control</th>
                <th className="px-2 py-3 text-left font-medium">SLA (hours)</th>
                <th className="px-2 py-3 text-left font-medium">Last changed</th>
                <th className="px-5 py-3 text-left font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-text-muted">
                    Loading maker-checker policies…
                  </td>
                </tr>
              ) : query.isError ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-danger-text">
                    Failed to load policies. Please try refreshing.
                  </td>
                </tr>
              ) : (
                policies.map((policy, i) => {
                  const copy = ACTIVITY_COPY[policy.entityType];
                  const draft = drafts[policy.entityType];
                  const dirty = draft !== undefined && draft !== policy.slaHours;
                  const saving = savingType === policy.entityType;
                  return (
                    <tr key={policy.entityType} className={i === policies.length - 1 ? '' : 'border-b border-border-row'}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-text-primary">{copy.label}</p>
                        <p className="mt-0.5 max-w-[280px] text-[12px] text-text-muted">{copy.description}</p>
                      </td>
                      <td className="px-2 py-3">
                        <button
                          disabled={saving}
                          onClick={() => void save(policy, { enabled: !policy.enabled })}
                          className={cn(
                            'relative h-[19px] w-[34px] rounded-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                            policy.enabled ? 'bg-accent' : 'bg-track',
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-[2px] h-[15px] w-[15px] rounded-full bg-white transition-[left]',
                              policy.enabled ? 'left-[17px]' : 'left-[2px]',
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={720}
                            value={draft ?? policy.slaHours}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [policy.entityType]: Number(e.target.value) }))
                            }
                            className="w-[64px] rounded-[8px] border border-border-input bg-surface px-2 py-[6px] font-mono text-[12.5px] text-text-primary outline-none focus:border-accent"
                          />
                          {dirty && (
                            <button
                              disabled={saving}
                              onClick={() => void save(policy, { slaHours: draft })}
                              className="flex items-center gap-1 rounded-[7px] bg-button-primary px-2.5 py-[6px] text-[12px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                              Save
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-text-muted">{formatDate(policy.updatedAt)}</td>
                      <td className="px-5 py-3 text-text-muted">{copy.source}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[14px] border border-border-default bg-surface p-5">
        <p className="text-[13px] font-semibold text-text-primary">Not shown here</p>
        <p className="mt-1.5 max-w-[720px] text-[12.5px] leading-[1.55] text-text-muted">
          Settlement batches, fee-rule changes, transaction-limit changes and general config changes have
          maker-checker entity types reserved in the schema, but no workflow creates a checker task for them yet —
          so there is nothing real to configure here for those activities until that code exists.
        </p>
        <p className="mt-2.5 border-t border-border-hairline pt-2.5 text-[12px] leading-[1.5] text-text-muted">
          Every change on this page is itself logged to the audit trail.
        </p>
      </div>
    </div>
  );
}
