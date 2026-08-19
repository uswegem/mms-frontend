'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { getMerchant } from '@/lib/merchants-api';
import { MerchantQrTab } from '@/components/merchants/qr/merchant-qr-tab';

export default function MerchantQrPage() {
  const { accessToken, user } = useAuth();
  const token = accessToken ?? '';
  const merchantId = user?.merchantId ?? '';
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const merchantQuery = useQuery({
    queryKey: ['merchant-qr-page-merchant', merchantId],
    queryFn: () => getMerchant(token, merchantId),
    enabled: !!accessToken && !!merchantId,
  });

  return (
    <div className="-m-6 flex flex-col gap-4 p-[26px_34px_34px]">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">
          QR &amp; Lipa Namba management
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Generate and manage your TANQR static and dynamic payment codes.
        </p>
      </div>

      {notice && (
        <div
          className={
            notice.kind === 'success'
              ? 'rounded-[10px] border border-success-border bg-success-bg px-4 py-2.5 text-[13px] text-success-text'
              : 'rounded-[10px] border border-danger bg-danger-bg px-4 py-2.5 text-[13px] text-danger-text'
          }
        >
          {notice.text}
        </div>
      )}

      {merchantQuery.isLoading && <p className="text-[13px] text-text-muted">Loading…</p>}

      {merchantQuery.data && (
        <MerchantQrTab
          merchant={merchantQuery.data}
          onSuccess={(text) => setNotice({ kind: 'success', text })}
          onError={(text) => setNotice({ kind: 'error', text })}
        />
      )}
    </div>
  );
}
