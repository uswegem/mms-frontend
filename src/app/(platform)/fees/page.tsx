'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import {
  activateFeeSchedule,
  createFeeSchedule,
  listFeeSchedules,
  type CreateFeeScheduleChargeInput,
  type FeeChargeBasis,
  type FeeChargeType,
  type FeeSchedule,
  type FeeScheduleCharge,
  type FeeScheduleScope,
} from '@/lib/fee-schedules-api';
import { listMerchants, type Merchant } from '@/lib/merchants-api';
import { cn } from '@/lib/utils';

const CHARGE_ORDER: FeeChargeType[] = [
  'MDR',
  'SETTLEMENT_TRANSFER',
  'QR_POSTER_REPRINT',
  'DISPUTE_INVESTIGATION',
];

function chargeTypeLabel(t: FeeChargeType): string {
  switch (t) {
    case 'MDR':
      return 'MDR';
    case 'SETTLEMENT_TRANSFER':
      return 'Settlement transfer';
    case 'QR_POSTER_REPRINT':
      return 'QR poster reprint';
    case 'DISPUTE_INVESTIGATION':
      return 'Dispute investigation';
  }
}

function defaultBasisFor(t: FeeChargeType): FeeChargeBasis {
  switch (t) {
    case 'MDR':
      return 'PERCENT_OF_TRANSACTION';
    case 'SETTLEMENT_TRANSFER':
      return 'FLAT_PER_SWEEP';
    case 'QR_POSTER_REPRINT':
      return 'FLAT_PER_ASSET';
    case 'DISPUTE_INVESTIGATION':
      return 'FLAT_PER_CASE';
  }
}

function chargeValueLabel(c: FeeScheduleCharge): string {
  if (c.basis === 'PERCENT_OF_TRANSACTION') {
    return c.rate ? `${(Number(c.rate) * 100).toFixed(2)}%` : '—';
  }
  return `TZS ${new Intl.NumberFormat('en-TZ').format(Number(c.flatAmount ?? 0))}`;
}

function scopeLabel(schedule: FeeSchedule): string {
  if (schedule.scope === 'DEFAULT') return 'Platform default';
  if (schedule.scope === 'MCC') return `MCC ${schedule.scopeKey}`;
  return `Merchant ${schedule.scopeKey?.slice(0, 8)}…`;
}

function scopeChipLabel(scope: FeeScheduleScope): string {
  if (scope === 'DEFAULT') return 'Default';
  if (scope === 'MCC') return 'By MCC';
  return 'Merchant overrides';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ChargesList({ charges }: { charges: FeeScheduleCharge[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {CHARGE_ORDER.map((type) => {
        const charge = charges.find((c) => c.chargeType === type);
        if (!charge) return null;
        return (
          <span key={type} className="text-[12px] text-text-body">
            <span className="text-text-muted">{chargeTypeLabel(type)}:</span>{' '}
            <span className="font-mono tabular-nums">{chargeValueLabel(charge)}</span>
            {charge.capAmount && (
              <span className="text-text-muted">
                {' '}
                (cap TZS {new Intl.NumberFormat('en-TZ').format(Number(charge.capAmount))})
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export default function FeesPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'ALL' | FeeScheduleScope>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const canRead = user?.permissions?.includes('fee-schedule:read');
  const canWrite = user?.permissions?.includes('fee-schedule:write');
  const canApprove = user?.permissions?.includes('fee-schedule:approve');

  const query = useQuery({
    queryKey: ['fee-schedules'],
    queryFn: () => listFeeSchedules(accessToken!),
    enabled: !!accessToken && !!canRead,
  });

  if (!canRead) {
    return (
      <p className="py-20 text-center text-[13px] text-text-muted">No fee-schedule:read permission.</p>
    );
  }

  const schedules = query.data ?? [];
  const active = schedules
    .filter((s) => s.status === 'ACTIVE')
    .filter((s) => scopeFilter === 'ALL' || s.scope === scopeFilter);
  const drafts = schedules.filter((s) => s.status === 'DRAFT');
  const superseded = schedules.filter((s) => s.status === 'SUPERSEDED');
  const scopeCounts = {
    DEFAULT: schedules.filter((s) => s.status === 'ACTIVE' && s.scope === 'DEFAULT').length,
    MCC: schedules.filter((s) => s.status === 'ACTIVE' && s.scope === 'MCC').length,
    MERCHANT: schedules.filter((s) => s.status === 'ACTIVE' && s.scope === 'MERCHANT').length,
  };

  async function handleActivate(id: string) {
    setActivatingId(id);
    setError(null);
    try {
      await activateFeeSchedule(accessToken!, id);
      setSuccess('Schedule activated.');
      await queryClient.invalidateQueries({ queryKey: ['fee-schedules'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate schedule');
    } finally {
      setActivatingId(null);
    }
  }

  return (
    <div className="-m-6 flex flex-col p-[26px_34px_34px]">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1.5">LFB back office · system configuration</p>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">Fees &amp; MDR</h1>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-[9px] bg-button-primary px-[14px] py-[9px] text-[13px] font-medium text-white hover:bg-button-primary-hover"
          >
            New schedule version
          </button>
        )}
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

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setScopeFilter('ALL')}
          className={
            scopeFilter === 'ALL'
              ? 'rounded-[20px] bg-button-primary px-[13px] py-[6px] text-[12.5px] font-medium text-white'
              : 'rounded-[20px] border border-border-default bg-surface px-[13px] py-[6px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]'
          }
        >
          All {schedules.filter((s) => s.status === 'ACTIVE').length}
        </button>
        {(['DEFAULT', 'MCC', 'MERCHANT'] as const).map((scope) => (
          <button
            key={scope}
            onClick={() => setScopeFilter(scope)}
            className={
              scopeFilter === scope
                ? 'rounded-[20px] bg-button-primary px-[13px] py-[6px] text-[12.5px] font-medium text-white'
                : 'rounded-[20px] border border-border-default bg-surface px-[13px] py-[6px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]'
            }
          >
            {scopeChipLabel(scope)} {scopeCounts[scope]}
          </button>
        ))}
      </div>

      <div className="mb-6 overflow-hidden rounded-[14px] border border-border-default bg-surface">
        <div className="flex items-center justify-between border-b border-border-hairline px-5 py-[13px]">
          <p className="text-[14px] font-semibold text-text-primary">Active schedules</p>
          <p className="text-[12px] text-text-muted">{active.length} in force</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border-hairline text-[12px] font-medium text-text-muted">
                <th className="px-5 py-3 text-left font-medium">Scope</th>
                <th className="px-2 py-3 text-left font-medium">Charges</th>
                <th className="px-2 py-3 text-left font-medium">Version</th>
                <th className="px-2 py-3 text-left font-medium">Effective</th>
                <th className="px-5 py-3 text-left font-medium">Approved</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-text-muted">
                    Loading fee schedules…
                  </td>
                </tr>
              ) : query.isError ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-danger-text">
                    Failed to load fee schedules. Please try refreshing.
                  </td>
                </tr>
              ) : active.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-text-muted">
                    No active schedules for this scope.
                  </td>
                </tr>
              ) : (
                active.map((s, i) => (
                  <tr key={s.id} className={i === active.length - 1 ? '' : 'border-b border-border-row'}>
                    <td className="px-5 py-3 font-medium text-text-primary">{scopeLabel(s)}</td>
                    <td className="px-2 py-3">
                      <ChargesList charges={s.charges} />
                    </td>
                    <td className="px-2 py-3 font-mono text-text-muted">v{s.version}</td>
                    <td className="px-2 py-3 text-text-body">{formatDate(s.effectiveFrom)}</td>
                    <td className="px-5 py-3 text-text-muted">
                      {s.approvedBy ? (
                        <span title={s.approvedBy} className="font-mono text-[12px]">
                          {s.approvedBy.slice(0, 8)}…
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-[14px] border border-warning-border bg-surface">
          <div className="flex items-center justify-between border-b border-border-hairline px-5 py-[13px]">
            <p className="text-[14px] font-semibold text-text-primary">Pending activation</p>
            <p className="text-[12px] text-text-muted">{drafts.length} draft{drafts.length === 1 ? '' : 's'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-hairline text-[12px] font-medium text-text-muted">
                  <th className="px-5 py-3 text-left font-medium">Scope</th>
                  <th className="px-2 py-3 text-left font-medium">Charges</th>
                  <th className="px-2 py-3 text-left font-medium">Created</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((s, i) => {
                  const isMaker = s.createdBy === user?.sub;
                  return (
                    <tr key={s.id} className={i === drafts.length - 1 ? '' : 'border-b border-border-row'}>
                      <td className="px-5 py-3 font-medium text-text-primary">{scopeLabel(s)}</td>
                      <td className="px-2 py-3">
                        <ChargesList charges={s.charges} />
                      </td>
                      <td className="px-2 py-3 text-text-muted">{formatDate(s.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {isMaker && (
                            <span className="text-[12px] text-text-muted">You drafted this</span>
                          )}
                          {canApprove && !isMaker && (
                            <button
                              disabled={activatingId === s.id}
                              onClick={() => void handleActivate(s.id)}
                              className="flex items-center gap-1.5 rounded-[8px] bg-button-primary px-3 py-[6px] text-[12.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {activatingId === s.id && <Loader2 className="h-3 w-3 animate-spin" />}
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {superseded.length > 0 && (
        <div className="rounded-[14px] border border-border-default bg-surface p-5">
          <p className="mb-3 text-[13px] font-semibold text-text-primary">Version history</p>
          <div className="flex flex-col">
            {[...superseded]
              .sort((a, b) => b.version - a.version)
              .map((s, i, arr) => (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center justify-between py-[10px] text-[13px]',
                    i !== arr.length - 1 && 'border-b border-border-row',
                  )}
                >
                  <span>
                    <span className="mr-2 font-mono text-text-muted">v{s.version}</span>
                    {scopeLabel(s)} · superseded
                  </span>
                  <span className="text-text-muted">{formatDate(s.supersededAt)}</span>
                </div>
              ))}
          </div>
          <p className="mt-3 border-t border-border-hairline pt-3 text-[12px] leading-[1.5] text-text-muted">
            Versioning and approval-before-effect are enhancements for auditability; the BRS baseline
            requires only that fees be configurable.
          </p>
        </div>
      )}

      {showCreate && (
        <CreateScheduleModal
          token={accessToken!}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setSuccess('Draft schedule created — an approver can activate it below.');
            void queryClient.invalidateQueries({ queryKey: ['fee-schedules'] });
          }}
        />
      )}
    </div>
  );
}

interface ChargeRow {
  chargeType: FeeChargeType;
  basis: FeeChargeBasis;
  value: string;
  cap: string;
}

function initialChargeRows(): ChargeRow[] {
  return CHARGE_ORDER.map((chargeType) => ({
    chargeType,
    basis: defaultBasisFor(chargeType),
    value: '',
    cap: '',
  }));
}

function CreateScheduleModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [scope, setScope] = useState<FeeScheduleScope>('MCC');
  const [mcc, setMcc] = useState('');
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [rows, setRows] = useState<ChargeRow[]>(initialChargeRows());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function updateRow(chargeType: FeeChargeType, patch: Partial<ChargeRow>) {
    setRows((rs) => rs.map((r) => (r.chargeType === chargeType ? { ...r, ...patch } : r)));
  }

  const mccValid = /^[0-9]{4}$/.test(mcc);
  const scopeKeyValid = scope === 'DEFAULT' || (scope === 'MCC' ? mccValid : !!merchant);

  async function handleSubmit() {
    setFormError(null);
    const charges: CreateFeeScheduleChargeInput[] = [];
    for (const row of rows) {
      if (!row.value.trim()) continue; // blank rows are simply omitted
      const charge: CreateFeeScheduleChargeInput = { chargeType: row.chargeType, basis: row.basis };
      if (row.basis === 'PERCENT_OF_TRANSACTION') {
        charge.rate = Number(row.value) / 100;
      } else {
        charge.flatAmount = Number(row.value);
      }
      if (row.cap.trim()) charge.capAmount = Number(row.cap);
      charges.push(charge);
    }
    if (charges.length === 0) {
      setFormError('Enter at least one charge.');
      return;
    }
    setSubmitting(true);
    try {
      await createFeeSchedule(token, {
        scope,
        scopeKey: scope === 'DEFAULT' ? undefined : scope === 'MCC' ? mcc : merchant!.id,
        charges,
      });
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[14px] border border-border-default bg-surface p-6">
        <p className="text-[16px] font-semibold text-text-primary">New schedule version</p>
        <p className="mt-1 text-[12.5px] text-text-muted">
          Creates a draft — a different approver must activate it before it takes effect.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-text-body">Scope</span>
            <div className="flex gap-2">
              {(['DEFAULT', 'MCC', 'MERCHANT'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={cn(
                    'flex-1 rounded-[9px] border px-3 py-[9px] text-[12.5px] transition-colors',
                    scope === s
                      ? 'border-2 border-accent bg-accent-bg font-medium text-text-primary'
                      : 'border-border-default bg-surface text-text-body hover:border-[#c9c9c3]',
                  )}
                >
                  {scopeChipLabel(s)}
                </button>
              ))}
            </div>
          </div>

          {scope === 'MCC' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] text-text-body">
                MCC code <span className="text-required">*</span>
              </span>
              <input
                value={mcc}
                onChange={(e) => setMcc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="5411"
                className="rounded-[9px] border border-border-input bg-surface px-3 py-[10px] font-mono text-[13.5px] text-text-primary outline-none focus:border-accent"
              />
              {mcc && !mccValid && <p className="text-[12px] text-danger-text">MCC must be 4 digits</p>}
            </div>
          )}

          {scope === 'MERCHANT' && <MerchantPicker token={token} value={merchant} onChange={setMerchant} />}

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] text-text-body">Charges — leave blank to omit</span>
            {rows.map((row) => (
              <div key={row.chargeType} className="flex items-center gap-2">
                <span className="w-[150px] shrink-0 text-[12.5px] text-text-body">
                  {chargeTypeLabel(row.chargeType)}
                </span>
                <div className="flex flex-1 items-center gap-1.5 rounded-[9px] border border-border-input px-3 py-[8px]">
                  <input
                    value={row.value}
                    onChange={(e) => updateRow(row.chargeType, { value: e.target.value.replace(/[^0-9.]/g, '') })}
                    placeholder={row.basis === 'PERCENT_OF_TRANSACTION' ? '0.85' : '0'}
                    className="w-full bg-transparent font-mono text-[13px] text-text-primary outline-none"
                  />
                  <span className="shrink-0 text-[12px] text-text-muted">
                    {row.basis === 'PERCENT_OF_TRANSACTION' ? '%' : 'TZS'}
                  </span>
                </div>
                {row.chargeType === 'MDR' && (
                  <div className="flex w-[110px] shrink-0 items-center gap-1.5 rounded-[9px] border border-border-input px-3 py-[8px]">
                    <input
                      value={row.cap}
                      onChange={(e) => updateRow(row.chargeType, { cap: e.target.value.replace(/[^0-9.]/g, '') })}
                      placeholder="cap"
                      className="w-full bg-transparent font-mono text-[13px] text-text-primary outline-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {formError && <p className="text-[13px] text-danger-text">{formError}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-[9px] border border-border-input px-4 py-[9px] text-[13px] text-text-body hover:border-[#c9c9c3]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !scopeKeyValid}
            onClick={() => void handleSubmit()}
            className="flex items-center gap-2 rounded-[9px] bg-button-primary px-4 py-[9px] text-[13px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save draft
          </button>
        </div>
      </div>
    </div>
  );
}

function MerchantPicker({
  token,
  value,
  onChange,
}: {
  token: string;
  value: Merchant | null;
  onChange: (m: Merchant | null) => void;
}) {
  const [query, setQueryText] = useState('');
  const [results, setResults] = useState<Merchant[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Don't clear `results` synchronously here — the render guard below
    // (query.trim() && !value) already hides stale results when cleared.
    if (!query.trim() || value) return;
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      listMerchants(token, 1, 6, query)
        .then((res) => setResults(res.data))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, value]);

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] text-text-body">Merchant</span>
        <div className="flex items-center justify-between rounded-[9px] border border-accent-border bg-accent-bg px-3 py-[9px]">
          <span className="text-[13px] text-text-primary">
            {value.tradingName} <span className="text-text-muted">({value.legalName})</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[12px] text-accent-link hover:text-accent-link-hover"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <span className="text-[12.5px] text-text-body">
        Merchant <span className="text-required">*</span>
      </span>
      <input
        value={query}
        onChange={(e) => setQueryText(e.target.value)}
        placeholder="Search by trading or legal name…"
        className="rounded-[9px] border border-border-input bg-surface px-3 py-[10px] text-[13.5px] text-text-primary outline-none focus:border-accent"
      />
      {query.trim() && (searching || results.length > 0) && (
        <div className="absolute top-[68px] z-10 w-full rounded-[9px] border border-border-default bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
          {searching ? (
            <p className="px-3 py-2.5 text-[12.5px] text-text-muted">Searching…</p>
          ) : (
            results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m);
                  setQueryText('');
                  setResults([]);
                }}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-subtle"
              >
                <span className="text-[13px] text-text-primary">{m.tradingName}</span>
                <span className="text-[11.5px] text-text-muted">
                  {m.legalName} · MCC {m.mcc}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
