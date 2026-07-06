'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { MerchantQrEligibility } from '@/types/merchant-qr';
import type { Merchant } from '@/lib/merchants-api';

interface QrEligibilityBlockerProps {
  merchant: Merchant;
  eligibility?: MerchantQrEligibility;
  onRefresh: () => void;
}

function CheckItem({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail?: string;
}) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? 'text-[var(--success)]' : 'text-muted-foreground'}`}
      />
      <span>
        <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
        {detail && (
          <span className="ml-1 text-xs text-muted-foreground">({detail})</span>
        )}
      </span>
    </li>
  );
}

export function QrEligibilityBlocker({
  merchant,
  eligibility,
  onRefresh,
}: QrEligibilityBlockerProps) {
  const kycStatus = merchant.kyc?.status ?? 'PENDING';
  const kycApproved = eligibility?.kyc_approved ?? kycStatus === 'APPROVED';

  return (
    <Card className="border-[color-mix(in_srgb,var(--brand-yellow)_35%,transparent)]">
      <CardHeader>
        <CardTitle className="text-base">QR generation is not available yet</CardTitle>
        <CardDescription>
          This merchant must be approved and activated before TANQR QR codes can be issued.
          {merchant.status === 'PENDING_REVIEW' && (
            <> QR generation is blocked until merchant approval is completed.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          <CheckItem
            ok={kycApproved}
            label="KYC approved"
            detail={kycStatus}
          />
          <CheckItem
            ok={eligibility?.merchant_active ?? merchant.status === 'ACTIVE'}
            label="Merchant status ACTIVE"
            detail={merchant.status}
          />
          <CheckItem
            ok={eligibility?.alias_available ?? false}
            label="Alias / Lipa Namba available"
          />
          <CheckItem
            ok={eligibility?.tips_registered ?? false}
            label="TIPS registration available"
          />
          <CheckItem
            ok={eligibility?.settlement_configured ?? false}
            label="Settlement account configured"
          />
        </ul>
        <div className="flex flex-wrap gap-2">
          <Link href={`/merchants/${merchant.id}?tab=kyc`}>
            <Button variant="outline" size="sm">
              View KYC
            </Button>
          </Link>
          <Link href={`/merchants/${merchant.id}?tab=status`}>
            <Button variant="outline" size="sm">
              View Status
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
