'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { getMerchant } from '@/lib/merchants-api';
import { SchoolStudentsPanel } from '@/components/schools/school-students-panel';

export default function MerchantRosterPage() {
  const { accessToken, user } = useAuth();
  const token = accessToken ?? '';
  const merchantId = user?.merchantId ?? '';

  const merchantQuery = useQuery({
    queryKey: ['merchant-roster-page-merchant', merchantId],
    queryFn: () => getMerchant(token, merchantId),
    enabled: !!accessToken && !!merchantId,
  });

  return (
    <div className="-m-6 flex flex-col gap-4 p-[26px_34px_34px]">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">
          Student roster
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Enrol students individually or import a roster in bulk — each row becomes a permanent
          Lipa Namba and TANQR code linked to your school&rsquo;s master account.
        </p>
      </div>

      {merchantQuery.isLoading && <p className="text-[13px] text-text-muted">Loading…</p>}

      {merchantQuery.data && !merchantQuery.data.isSchool && (
        <div className="rounded-[14px] border border-border-default bg-surface p-8 text-center">
          <p className="text-[13px] text-text-muted">
            Student rosters are only available for school merchants.
          </p>
        </div>
      )}

      {merchantQuery.data?.isSchool && <SchoolStudentsPanel merchantId={merchantId} />}
    </div>
  );
}
