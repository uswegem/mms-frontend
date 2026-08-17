'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, QrCode, Zap } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { getMerchantAlias } from '@/lib/alias-api';
import { simulatePayment } from '@/lib/transactions-api';
import { usePaymentConfirmedEvents, type PaymentConfirmedEvent } from '@/lib/realtime';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const realtimeStatus = usePaymentConfirmedEvents(accessToken, (event) => {
    // Any confirmation for this merchant lands here — a real till would
    // only care once an amount is showing, but for the demo/dev flow we
    // just show whatever arrives.
    setConfirmed(event);
  });

  async function handleSimulate() {
    if (!alias?.alias8digit || !amount) return;
    setSimulating(true);
    setError(null);
    try {
      await simulatePayment({ alias: alias.alias8digit, amount });
      // Confirmation arrives over the socket, not the HTTP response — this
      // call only tells TIPS-the-mock a payment happened, the same way a
      // real payer's bank app would trigger the real TIPS webhook.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  }

  function nextCustomer() {
    setConfirmed(null);
    setAmount('');
  }

  if (confirmed) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="border-[var(--success-border)]">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-muted)]">
              <CheckCircle2 className="h-7 w-7 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-lg font-semibold">Payment received</p>
              <p className="text-sm text-muted-foreground">Confirmed over the live connection — not polled</p>
            </div>
            <p className="text-3xl font-semibold tabular-nums">
              {formatCurrency(Number(confirmed.amount), confirmed.currency)}
            </p>
            <dl className="w-full space-y-2 border-t border-border pt-4 text-left text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Payer</dt>
                <dd>{confirmed.payerFsp ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">TIPS reference</dt>
                <dd className="font-mono text-xs">{confirmed.tipsEndToEndId}</dd>
              </div>
            </dl>
            <Button onClick={nextCustomer} className="w-full">
              Next customer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> Take a payment
          </CardTitle>
          <CardDescription>
            {alias
              ? `Lipa Namba ${formatLipaNamba(alias.alias8digit)}`
              : 'Loading your Lipa Namba…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount to collect (TZS)</Label>
            <Input
              id="amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              className="mt-1.5 text-2xl font-semibold tabular-nums"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <Button key={a} variant="outline" size="sm" onClick={() => setAmount(a)}>
                +{formatCurrency(Number(a), 'TZS', true)}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <span
              className={
                realtimeStatus === 'connected'
                  ? 'h-2 w-2 shrink-0 rounded-full bg-[var(--success)]'
                  : 'h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--warning)]'
              }
            />
            {realtimeStatus === 'connected'
              ? 'Live connection open — confirmation will appear instantly'
              : 'Connecting…'}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            size="lg"
            disabled={!amount || !alias || simulating}
            onClick={handleSimulate}
          >
            {simulating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Simulate payment (dev)
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Stands in for a payer scanning this Lipa Namba until real TIPS
            sandbox access exists — everything downstream (webhook, ledger,
            live push) is the real path.{' '}
            <Badge variant="outline" className="ml-1 align-middle text-[10px]">
              dev only
            </Badge>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
