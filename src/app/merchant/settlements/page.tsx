'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { listSettlements, type SettlementCycle } from '@/lib/settlements-api';
import { formatCurrency, formatDate } from '@/lib/format';

function statusPillColor(status: SettlementCycle['status']): string {
  switch (status) {
    case 'POSTED':
      return 'bg-success-bg text-success-text';
    case 'FAILED':
      return 'bg-danger-bg text-danger-text';
    default:
      return 'bg-warning-bg text-warning-text';
  }
}

export default function MerchantSettlementsPage() {
  const { accessToken } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-settlements'],
    queryFn: () => listSettlements(accessToken!, { pageSize: 30 }),
    enabled: Boolean(accessToken),
  });

  const items = data?.items ?? [];
  const sorted = [...items].sort(
    (a, b) => new Date(b.cycleDate).getTime() - new Date(a.cycleDate).getTime(),
  );
  const latest = sorted[0];
  const lastPosted = sorted.find((c) => c.status === 'POSTED');
  const awaitingSweep = items
    .filter((c) => c.status === 'PENDING')
    .reduce((sum, c) => sum + Number(c.netAmount), 0);
  const netToAccount = items
    .filter((c) => c.status === 'POSTED')
    .reduce((sum, c) => sum + Number(c.netAmount), 0);

  return (
    <div className="-m-6 flex flex-col p-[26px_34px_34px]">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">
            Settlement
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">Nightly sweep, MDR, and CBS posting per cycle · T+1 at 02:00</p>
        </div>
        <button className="rounded-[9px] border border-border-default bg-surface px-3 py-[7px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3]">
          Download statement
        </button>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-[14px]">
        {[
          ['Awaiting sweep', formatCurrency(awaitingSweep, 'TZS', true), `${items.filter((c) => c.status === 'PENDING').length} cycle(s)`],
          ['MDR this cycle', latest ? formatCurrency(Number(latest.mdrAmount), 'TZS', true) : '—', latest ? formatDate(latest.cycleDate) : ''],
          ['Net to account', formatCurrency(netToAccount, 'TZS', true), 'Posts to CBS ledger'],
          [
            'Last settled',
            lastPosted ? formatCurrency(Number(lastPosted.netAmount), 'TZS', true) : '—',
            lastPosted ? `${formatDate(lastPosted.cycleDate)} · complete` : 'No posted cycles yet',
          ],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-[14px] border border-border-default bg-surface p-[18px]">
            <p className="text-[12.5px] text-text-muted">{label}</p>
            <p className="mt-[10px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
              {value}
            </p>
            <p className="mt-1 text-[12px] text-text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[14px] border border-border-default bg-surface">
        <div className="px-5 py-4">
          <h2 className="text-[15px] font-semibold text-text-primary">Settlement cycles</h2>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-y border-border-hairline text-[12px] font-medium text-text-muted">
              <th className="px-5 py-3 text-left font-medium">Cycle</th>
              <th className="px-2 py-3 text-right font-medium">Txns</th>
              <th className="px-2 py-3 text-right font-medium">Gross TZS</th>
              <th className="px-2 py-3 text-right font-medium">MDR</th>
              <th className="px-2 py-3 text-right font-medium">Net</th>
              <th className="px-2 py-3 text-left font-medium">CBS posting</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-text-muted">
                  No settlement cycles yet — the nightly sweep runs at 02:00.
                </td>
              </tr>
            )}
            {sorted.map((c, i) => (
              <tr key={c.id} className={i < sorted.length - 1 ? 'border-b border-border-row' : ''}>
                <td className="px-5 py-3 text-text-body">{formatDate(c.cycleDate)}</td>
                <td className="px-2 py-3 text-right tabular-nums text-text-body">
                  {c.transactionCount}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-text-body">
                  {formatCurrency(Number(c.grossAmount))}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-text-muted">
                  {formatCurrency(Number(c.mdrAmount))}
                </td>
                <td className="px-2 py-3 text-right font-medium tabular-nums text-text-primary">
                  {formatCurrency(Number(c.netAmount))}
                </td>
                <td className="px-2 py-3 font-mono text-[12px] text-text-muted">
                  {c.cbsPostingRef ?? '—'}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-[20px] px-2.5 py-1 text-[11.5px] font-medium ${statusPillColor(c.status)}`}
                  >
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-[14px]">
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="mb-2 text-[13px] font-semibold text-text-primary">Two-stage money movement</p>
          <p className="text-[13px] leading-relaxed text-text-secondary">
            Collected funds sweep from the merchant&apos;s TIPS-linked wallet to the
            nominated settlement account on schedule, and each settled transaction
            posts to the corresponding CBS ledger account — a discrete step, in
            addition to internal record keeping.
          </p>
        </div>
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="mb-2 text-[13px] font-semibold text-text-primary">Statement contents</p>
          <p className="text-[13px] leading-relaxed text-text-secondary">
            Daily, weekly and monthly statements per merchant, branch or school.
            Every row carries the TIPS common reference number and the fee schedule
            version in force at transaction time.
          </p>
        </div>
      </div>
    </div>
  );
}
