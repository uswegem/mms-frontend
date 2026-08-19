'use client';

import { use, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/layout/brand-logo';
import {
  getPublicPaymentLink,
  isLinkExpired,
  payPublicLink,
  type PublicPaymentLink,
} from '@/lib/payment-links-api';
import { formatCurrency, formatDateTime } from '@/lib/format';

export default function PayLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkQuery = useQuery({
    queryKey: ['public-payment-link', slug],
    queryFn: () => getPublicPaymentLink(slug),
  });

  async function handlePay(link: PublicPaymentLink) {
    setPaying(true);
    setError(null);
    try {
      await payPublicLink(slug, link);
      await queryClient.invalidateQueries({ queryKey: ['public-payment-link', slug] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>

        {linkQuery.isLoading && (
          <p className="text-center text-[13px] text-text-muted">Loading…</p>
        )}

        {linkQuery.isError && (
          <div className="rounded-[14px] border border-border-default bg-surface p-8 text-center">
            <p className="text-[15px] font-semibold text-text-primary">Link not found</p>
            <p className="mt-1.5 text-[13px] text-text-muted">
              This payment link doesn&rsquo;t exist or has been removed.
            </p>
          </div>
        )}

        {linkQuery.data && (
          <PayCard
            link={linkQuery.data}
            paying={paying}
            error={error}
            onPay={() => void handlePay(linkQuery.data)}
          />
        )}
      </div>
    </div>
  );
}

function PayCard({
  link,
  paying,
  error,
  onPay,
}: {
  link: PublicPaymentLink;
  paying: boolean;
  error: string | null;
  onPay: () => void;
}) {
  const expired = isLinkExpired(link);

  if (link.status === 'PAID') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[14px] border border-success-border bg-surface p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-success-text" />
        <p className="text-[17px] font-semibold text-text-primary">Payment received</p>
        <p className="text-[13px] text-text-muted">
          {formatCurrency(Number(link.amount), link.currency)} for {link.itemName}
        </p>
        {link.paidAt && (
          <p className="text-[12px] text-text-disabled">Paid {formatDateTime(link.paidAt)}</p>
        )}
        <p className="mt-1 text-[12px] leading-[1.5] text-text-muted">
          A receipt has been sent automatically. Thank you for paying{' '}
          {link.merchant.tradingName}.
        </p>
      </div>
    );
  }

  if (link.status === 'CANCELLED') {
    return (
      <div className="rounded-[14px] border border-border-default bg-surface p-8 text-center">
        <p className="text-[15px] font-semibold text-text-primary">This link was cancelled</p>
        <p className="mt-1.5 text-[13px] text-text-muted">
          Ask {link.merchant.tradingName} for a new payment link.
        </p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="rounded-[14px] border border-border-default bg-surface p-8 text-center">
        <p className="text-[15px] font-semibold text-text-primary">This link has expired</p>
        <p className="mt-1.5 text-[13px] text-text-muted">
          Ask {link.merchant.tradingName} to reissue it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-[14px] border border-border-default bg-surface p-6">
      <div className="flex h-24 items-center justify-center rounded-[12px] border border-border-default bg-page text-[11px] text-text-disabled">
        product photo
      </div>
      <div>
        <p className="text-[12px] text-text-muted">{link.merchant.tradingName}</p>
        <p className="mt-0.5 text-[19px] font-semibold text-text-primary">{link.itemName}</p>
        {link.description && (
          <p className="mt-1 text-[13px] text-text-muted">{link.description}</p>
        )}
      </div>
      <p className="font-mono text-[26px] font-semibold tabular-nums text-text-primary">
        {formatCurrency(Number(link.amount), link.currency)}
      </p>

      {error && <p className="text-[12.5px] text-danger-text">{error}</p>}

      <button
        disabled={paying}
        onClick={onPay}
        className="flex items-center justify-center gap-2 rounded-[10px] bg-button-primary py-3 text-[14px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {paying && <Loader2 className="h-4 w-4 animate-spin" />}
        {paying ? 'Processing…' : 'Pay with Lipa Namba'}
      </button>
      <p className="text-center text-[11.5px] leading-[1.5] text-text-disabled">
        Dev/UAT — simulates a real TIPS payment confirmation; there is no live TIPS sandbox to
        pay from here yet.
      </p>
    </div>
  );
}
