'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { getMerchant } from '@/lib/merchants-api';
import { getMerchantAlias } from '@/lib/alias-api';
import { listStudents } from '@/lib/students-api';
import { formatDateTime, formatLipaNamba } from '@/lib/format';

export default function SchoolDashboardPage() {
  const { accessToken, user } = useAuth();
  const token = accessToken ?? '';
  const merchantId = user?.merchantId ?? '';

  const merchantQuery = useQuery({
    queryKey: ['school-dashboard-merchant', merchantId],
    queryFn: () => getMerchant(token, merchantId),
    enabled: !!accessToken && !!merchantId,
  });
  const aliasQuery = useQuery({
    queryKey: ['school-dashboard-alias', merchantId],
    queryFn: () => getMerchantAlias(token, merchantId),
    enabled: !!accessToken && !!merchantId,
  });
  const studentsQuery = useQuery({
    queryKey: ['school-dashboard-students', merchantId],
    queryFn: () => listStudents(token, merchantId),
    enabled: !!accessToken && !!merchantId,
  });

  const merchant = merchantQuery.data;

  if (merchantQuery.data && !merchant?.isSchool) {
    return (
      <div className="-m-6 flex flex-col p-[26px_34px_34px]">
        <div className="rounded-[14px] border border-border-default bg-surface p-8 text-center">
          <p className="text-[13px] text-text-muted">
            The school overview is only available for school merchants.
          </p>
        </div>
      </div>
    );
  }

  const students = studentsQuery.data ?? [];
  const active = students.filter((s) => s.status === 'ACTIVE').length;
  const suspended = students.filter((s) => s.status === 'SUSPENDED').length;
  const inactive = students.filter((s) => s.status === 'INACTIVE').length;
  const withAlias = students.filter((s) => s.studentAlias).length;
  const recent = students.slice(0, 8);

  return (
    <div className="-m-6 flex flex-col gap-4 p-[26px_34px_34px]">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1.5">
            MASTER ALIAS {aliasQuery.data ? formatLipaNamba(aliasQuery.data.alias8digit) : '—'} ·{' '}
            {students.length} STUDENT{students.length === 1 ? '' : 'S'}
          </p>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">
            {merchant?.tradingName ?? 'School'}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {[merchant?.profile?.city, merchant?.status].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <Link
          href="/merchant/roster"
          className="rounded-[9px] border border-border-default bg-surface px-3.5 py-[9px] text-[13px] text-text-body hover:border-[#c9c9c3]"
        >
          Manage roster
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-[14px]">
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="text-[12.5px] text-text-muted">Enrolled students</p>
          <p className="mt-[9px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
            {students.length}
          </p>
          <p className="mt-0.5 text-[12px] text-text-muted">{active} active</p>
        </div>
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="text-[12.5px] text-text-muted">Lipa Namba issued</p>
          <p className="mt-[9px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
            {withAlias}
          </p>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {students.length - withAlias} pending
          </p>
        </div>
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="text-[12.5px] text-text-muted">Suspended</p>
          <p className="mt-[9px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
            {suspended}
          </p>
        </div>
        <div className="rounded-[14px] border border-border-default bg-surface p-[18px]">
          <p className="text-[12.5px] text-text-muted">Inactive</p>
          <p className="mt-[9px] text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
            {inactive}
          </p>
        </div>
      </div>

      <div className="rounded-[14px] border border-border-default bg-surface">
        <div className="flex items-center justify-between border-b border-border-hairline px-5 py-[15px]">
          <p className="text-[15px] font-semibold text-text-primary">Recently enrolled</p>
          <Link href="/merchant/roster" className="text-[12.5px] text-accent-link hover:text-accent-link-hover">
            Full roster
          </Link>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border-hairline text-[12px] font-medium text-text-muted">
              <th className="px-5 py-2.5 text-left font-medium">Student</th>
              <th className="px-2 py-2.5 text-left font-medium">Admission</th>
              <th className="px-2 py-2.5 text-left font-medium">Lipa Namba</th>
              <th className="px-5 py-2.5 text-left font-medium">Enrolled</th>
            </tr>
          </thead>
          <tbody>
            {studentsQuery.isLoading ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : recent.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-text-muted">
                  No students enrolled yet — upload a roster to get started.
                </td>
              </tr>
            ) : (
              recent.map((s, i) => (
                <tr key={s.id} className={i < recent.length - 1 ? 'border-b border-border-row' : ''}>
                  <td className="px-5 py-2.5 text-text-body">{s.fullName}</td>
                  <td className="px-2 py-2.5 font-mono text-[12px] text-text-muted">{s.admissionNo}</td>
                  <td className="px-2 py-2.5 font-mono tracking-widest text-text-body">
                    {s.studentAlias ? formatLipaNamba(s.studentAlias.alias10digit) : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-text-muted">{formatDateTime(s.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] leading-[1.5] text-text-disabled">
        Per-student fee balances, class/stream grouping, and term collections aren&rsquo;t tracked
        by MMS yet — this overview reflects roster and Lipa Namba issuance only.
      </p>
    </div>
  );
}
