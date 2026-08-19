'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import {
  cancelPaymentLink,
  createPaymentLink,
  effectiveLinkStatus,
  listPaymentLinks,
  reissuePaymentLink,
  type PaymentLink,
} from '@/lib/payment-links-api';
import { formatCurrency, formatDateTime } from '@/lib/format';

const STATUS_PILL: Record<string, string> = {
  ACTIVE: 'bg-warning-bg text-warning-text',
  PAID: 'bg-success-bg text-success-text',
  EXPIRED: 'bg-track text-text-muted',
  CANCELLED: 'bg-track text-text-disabled',
};

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const hrs = Math.floor(ms / 3_600_000);
  if (hrs < 1) return `in ${Math.floor(ms / 60_000)}m`;
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${Math.floor(hrs / 24)}d`;
}

export default function MerchantLinksPage() {
  const { accessToken, user } = useAuth();
  const token = accessToken ?? '';
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [shareLink, setShareLink] = useState<PaymentLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canWrite = user?.permissions?.includes('payment-link:write');

  const linksQuery = useQuery({
    queryKey: ['payment-links'],
    queryFn: () => listPaymentLinks(token),
    enabled: !!accessToken,
  });

  const items = linksQuery.data ?? [];
  const active = items.filter((l) => effectiveLinkStatus(l) === 'ACTIVE');

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['payment-links'] });
  }

  async function run(label: string, fn: () => Promise<PaymentLink>) {
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

  return (
    <div className="-m-6 flex flex-col gap-4 p-[26px_34px_34px]">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-text-primary">
            Payment links &amp; storefront
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {active.length} active link{active.length === 1 ? '' : 's'}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-[9px] bg-button-primary px-3.5 py-[9px] text-[13px] font-medium text-white hover:bg-button-primary-hover"
          >
            New payment link
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-[10px] border border-danger bg-danger-bg px-4 py-2.5 text-[13px] text-danger-text">
          {error}
        </div>
      )}

      {showForm && (
        <NewLinkForm
          onCreated={async (link) => {
            setShowForm(false);
            await refresh();
            setShareLink(link);
          }}
          onCreate={(body) => run('Create link', () => createPaymentLink(token, body))}
        />
      )}

      <div className="grid grid-cols-[1.4fr_1fr] items-start gap-5">
        <div className="rounded-[14px] border border-border-default bg-surface">
          <p className="border-b border-border-hairline px-5 py-[15px] text-[15px] font-semibold text-text-primary">
            Active payment links
          </p>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border-hairline text-[12px] font-medium text-text-muted">
                <th className="px-5 py-2.5 text-left font-medium">Item</th>
                <th className="px-2 py-2.5 text-left font-medium">Order ref</th>
                <th className="px-2 py-2.5 text-right font-medium">TZS</th>
                <th className="px-2 py-2.5 text-left font-medium">Expires</th>
                <th className="px-2 py-2.5 text-left font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {linksQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                    No payment links yet.
                  </td>
                </tr>
              ) : (
                items.map((link, i) => {
                  const status = effectiveLinkStatus(link);
                  return (
                    <tr
                      key={link.id}
                      className={i < items.length - 1 ? 'border-b border-border-row' : ''}
                    >
                      <td className="px-5 py-2.5 text-text-body">{link.itemName}</td>
                      <td className="px-2 py-2.5 font-mono text-[12px] text-text-muted">
                        {link.orderRef}
                      </td>
                      <td className="px-2 py-2.5 text-right font-medium tabular-nums text-text-primary">
                        {formatCurrency(Number(link.amount), link.currency)}
                      </td>
                      <td className="px-2 py-2.5 text-text-muted">
                        {status === 'ACTIVE' ? timeUntil(link.expiresAt) : '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={`rounded-[20px] px-2.5 py-1 text-[11.5px] font-medium ${STATUS_PILL[status]}`}
                        >
                          {status[0]}{status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {status === 'ACTIVE' && (
                          <span className="flex justify-end gap-3">
                            <button
                              onClick={() => setShareLink(link)}
                              className="text-[12.5px] text-accent-link hover:text-accent-link-hover"
                            >
                              Share
                            </button>
                            {canWrite && (
                              <button
                                onClick={() => void run('Cancel', () => cancelPaymentLink(token, link.id))}
                                className="text-[12.5px] text-text-muted hover:text-danger-text"
                              >
                                Cancel
                              </button>
                            )}
                          </span>
                        )}
                        {(status === 'EXPIRED' || status === 'CANCELLED') && canWrite && (
                          <button
                            onClick={() => void run('Reissue', () => reissuePaymentLink(token, link.id))}
                            className="text-[12.5px] text-accent-link hover:text-accent-link-hover"
                          >
                            Reissue
                          </button>
                        )}
                        {status === 'PAID' && <span className="text-[12.5px] text-text-disabled">Done</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3.5">
          {shareLink ? (
            <SharePanel link={shareLink} onClose={() => setShareLink(null)} />
          ) : (
            <div className="rounded-[14px] border border-border-default bg-surface p-5">
              <p className="text-[13px] font-semibold text-text-primary">Order matching</p>
              <p className="mt-2 text-[12.5px] leading-[1.55] text-text-muted">
                Every link carries an order reference, so a payment ties back to the specific
                Instagram or WhatsApp conversation. The buyer gets an automatic receipt on their
                phone.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewLinkForm({
  onCreate,
  onCreated,
}: {
  onCreate: (body: {
    itemName: string;
    orderRef: string;
    description?: string;
    amount: number;
  }) => Promise<PaymentLink | null>;
  onCreated: (link: PaymentLink) => Promise<void>;
}) {
  const [itemName, setItemName] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!itemName.trim() || !orderRef.trim() || !amount) return;
    setBusy(true);
    const link = await onCreate({
      itemName: itemName.trim(),
      orderRef: orderRef.trim(),
      amount: Number(amount),
    });
    setBusy(false);
    if (link) await onCreated(link);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border-default bg-surface p-5">
      <p className="text-[13px] font-semibold text-text-primary">New payment link</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="mb-1.5 text-[12px] text-text-muted">Item</p>
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Kitenge dress · size M"
            className="w-full rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[12px] text-text-muted">Order ref</p>
          <input
            value={orderRef}
            onChange={(e) => setOrderRef(e.target.value)}
            placeholder="IG-DM-3391"
            className="w-full rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[12px] text-text-muted">Amount (TZS)</p>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="85000"
            className="w-full rounded-[9px] border border-border-input bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
          />
        </div>
      </div>
      <button
        disabled={!itemName.trim() || !orderRef.trim() || !amount || busy}
        onClick={() => void handleSubmit()}
        className="self-start rounded-[9px] bg-button-primary px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create link'}
      </button>
    </div>
  );
}

function SharePanel({ link, onClose }: { link: PaymentLink; onClose: () => void }) {
  const payUrl = typeof window !== 'undefined' ? `${window.location.origin}/pay/${link.slug}` : `/pay/${link.slug}`;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(payUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-[14px] border border-border-default bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold text-text-primary">Share link {link.orderRef}</p>
        <button onClick={onClose} className="text-[12px] text-text-muted hover:text-text-body">
          ✕
        </button>
      </div>
      <div className="flex flex-col items-center gap-2.5 rounded-[12px] border border-border-default p-4">
        <p className="break-all text-center font-mono text-[12px] text-text-muted">{payUrl}</p>
      </div>
      <div className="flex flex-col gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Pay for ${link.itemName}: ${payUrl}`)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-[10px] border border-text-primary py-2.5 text-center text-[13px] text-text-primary hover:bg-page"
        >
          Share to WhatsApp
        </a>
        <button
          onClick={() => void copyLink()}
          className="rounded-[10px] border border-border-default bg-surface py-2.5 text-[13px] text-text-body hover:border-[#c9c9c3]"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
      {link.payment && (
        <p className="border-t border-border-hairline pt-2.5 text-[12px] text-text-muted">
          Created {formatDateTime(link.createdAt)}
        </p>
      )}
    </div>
  );
}
