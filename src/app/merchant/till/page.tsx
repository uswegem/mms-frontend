'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { getMerchantAlias } from '@/lib/alias-api';
import { simulatePayment } from '@/lib/transactions-api';
import { usePaymentConfirmedEvents, type PaymentConfirmedEvent } from '@/lib/realtime';
import { formatCurrency } from '@/lib/format';

const QUICK_AMOUNTS = ['1000', '5000', '10000', '28000'];

/** Groups a Lipa Namba digit string left-to-right in blocks of 4, e.g. "78000000" -> "7800 0000". */
function formatLipaNamba(value: string): string {
  return value.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export default function TillPage() {
  const { user, accessToken } = useAuth();
  const merchantId = user?.merchantId ?? null;

  const { data: alias } = useQuery({
    queryKey: ['merchant-alias', merchantId],
    queryFn: () => getMerchantAlias(accessToken!, merchantId!),
    enabled: Boolean(accessToken && merchantId),
  });

  const [amount, setAmount] = useState('');
  const [confirmed, setConfirmed] = useState<PaymentConfirmedEvent | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null);
  const [waitStarted, setWaitStarted] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const realtimeStatus = usePaymentConfirmedEvents(accessToken, (event) => {
    setConfirmed(event);
    setConfirmedAt(Date.now());
  });

  // Live "waiting for payment · m:ss" counter (handoff §paytill).
  useEffect(() => {
    if (!waitStarted || confirmed) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [waitStarted, confirmed]);

  async function handleSimulate() {
    if (!alias?.alias8digit || !amount) return;
    setSimulating(true);
    setError(null);
    setWaitStarted(Date.now());
    try {
      await simulatePayment({ alias: alias.alias8digit, amount });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
      setWaitStarted(null);
    } finally {
      setSimulating(false);
    }
  }

  function nextCustomer() {
    setConfirmed(null);
    setConfirmedAt(null);
    setWaitStarted(null);
    setAmount('');
  }

  const waitSeconds = waitStarted ? Math.floor((now - waitStarted) / 1000) : 0;
  const waitLabel = `${Math.floor(waitSeconds / 60)}:${String(waitSeconds % 60).padStart(2, '0')}`;
  const confirmSeconds =
    confirmedAt && waitStarted ? ((confirmedAt - waitStarted) / 1000).toFixed(1) : null;

  if (confirmed) {
    return (
      <div className="-m-6 grid grid-cols-[1fr_1fr] gap-5 p-5">
        {/* Left: payconf — 2px success border */}
        <div className="rounded-[14px] border-2 border-success-border bg-surface p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-strong text-white">
              ✓
            </div>
            <div>
              <p className="text-[20px] font-semibold text-text-primary">Payment received</p>
              <p className="mt-1 text-[13px] text-text-muted">
                {confirmSeconds ? `Confirmed in ${confirmSeconds}s · ` : ''}pushed over socket, not
                polled
              </p>
            </div>
          </div>
          <dl className="mt-6 divide-y divide-border-row text-[13.5px]">
            {[
              [
                'Amount',
                <span key="amt" className="font-medium tabular-nums text-text-primary">
                  {formatCurrency(Number(confirmed.amount), confirmed.currency)}
                </span>,
              ],
              ['Payer', confirmed.payerFsp ?? '—'],
              [
                'TIPS common reference',
                <span key="ref" className="font-mono text-[12.5px] text-text-body">
                  {confirmed.tipsEndToEndId}
                </span>,
              ],
              ['Settlement', 'Queued · T+1 sweep'],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between py-[11px]">
                <dt className="text-text-muted">{label}</dt>
                <dd className="text-text-primary">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={nextCustomer}
              className="rounded-[10px] bg-button-primary px-5 py-[11px] text-[13.5px] font-medium text-white transition-colors hover:bg-button-primary-hover"
            >
              Next customer
            </button>
            <button className="rounded-[10px] border border-border-input px-5 py-[11px] text-[13.5px] text-text-body transition-colors hover:border-[#c9c9c3]">
              Print receipt
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-[14px]">
          <div className="rounded-[14px] border border-border-default bg-surface p-5">
            <h3 className="mb-3 text-[13px] font-semibold text-text-primary">Fallback channels</h3>
            <div className="flex flex-col gap-2.5 text-[12.5px] text-text-body">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                <span>SMS confirmation sent to the owner&apos;s phone when the till has no reliable data connection</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                <span>Buyer auto-receipt sent to the payer&apos;s number for their records</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                <span>Stuck-in-pending status reconciles automatically against TIPS, with retry and a manual override for support staff</span>
              </div>
            </div>
          </div>
          <div className="rounded-[14px] border border-border-default bg-surface p-5">
            <h3 className="mb-3 text-[13px] font-semibold text-text-primary">Performance envelope</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ['60', 'TPS sustained'],
                ['50', 'concurrent users'],
                ['8s', 'end-to-end at peak'],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="text-[22px] font-semibold tabular-nums text-text-primary">{value}</p>
                  <p className="mt-1 text-[11.5px] text-text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-6 grid grid-cols-[1fr_1fr] gap-5 p-5">
      {/* Left: paytill */}
      <div className="rounded-[14px] border border-border-default bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[15px] font-semibold text-text-primary">Take a payment</p>
          <span className="rounded-[20px] bg-muted px-[11px] py-1 font-mono text-[11.5px] text-text-body">
            {alias ? formatLipaNamba(alias.alias8digit) : '—'}
          </span>
        </div>

        <p className="mb-2 text-[12.5px] text-text-muted">Amount to collect</p>
        <div className="rounded-[12px] border border-border-input px-[18px] py-4">
          <div className="flex items-baseline gap-2">
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              className="w-full bg-transparent text-[32px] font-semibold tabular-nums text-text-primary outline-none"
            />
            <span className="shrink-0 text-[15px] text-text-muted">TZS</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(a)}
              className="rounded-[8px] border border-border-default px-3 py-[7px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]"
            >
              +{new Intl.NumberFormat('en-TZ').format(Number(a))}
            </button>
          ))}
          <button
            onClick={() => setAmount('')}
            className="ml-auto text-[12.5px] text-accent-link hover:text-accent-link-hover"
          >
            Let payer enter amount
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-border-default bg-subtle p-3 text-[12px] text-text-muted">
          <span
            className={
              realtimeStatus === 'connected'
                ? 'h-[7px] w-[7px] shrink-0 rounded-full bg-success'
                : 'h-[7px] w-[7px] shrink-0 animate-pulse rounded-full bg-warning'
            }
          />
          {realtimeStatus === 'connected'
            ? 'Live connection open — confirmation will appear instantly'
            : 'Connecting…'}
        </div>

        {error && <p className="mt-3 text-[13px] text-danger-text">{error}</p>}

        <button
          disabled={!amount || !alias || simulating}
          onClick={handleSimulate}
          className="mt-5 w-full rounded-[10px] bg-button-primary px-5 py-[13px] text-[14px] font-medium text-white transition-colors hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {simulating ? 'Showing QR…' : 'Show QR to customer'}
        </button>
        <p className="mt-3 text-center text-[11px] text-text-disabled">
          Simulates a payer scan until real TIPS sandbox access exists — everything
          downstream (webhook, ledger, live push) is the real path. Dev only.
        </p>
      </div>

      {/* Right: dark customer-facing panel */}
      <div className="flex min-h-[440px] flex-col items-center justify-center rounded-[14px] bg-sidebar-bg p-[26px]">
        <p className="eyebrow mb-4 text-sidebar-text-muted">Customer-facing display</p>
        <div className="flex w-[280px] flex-col items-center gap-3 rounded-[16px] bg-white p-[22px] text-center">
          <p className="text-[13px] text-text-muted">Scan with any bank or wallet app</p>
          <div className="placeholder-qr h-[200px] w-[200px] rounded-[6px]" />
          <p className="text-[12px] text-text-muted">or enter Lipa Namba</p>
          <p className="font-mono text-[20px] font-semibold text-text-primary">
            {alias ? formatLipaNamba(alias.alias8digit) : '—'}
          </p>
          <p className="text-[24px] font-semibold tabular-nums text-text-primary">
            {amount ? formatCurrency(Number(amount)) : '—'}
          </p>
        </div>
        {waitStarted && (
          <div className="mt-4 flex items-center gap-2 text-[12.5px] text-[#8b8e92]">
            <span className="h-[7px] w-[7px] rounded-full bg-warning" />
            Waiting for payment · {waitLabel}
          </div>
        )}
      </div>
    </div>
  );
}
