'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listMerchants } from '@/lib/merchants-api';
import { getPaymentLedgerDetail, listSchoolPaymentLedger, paymentDailySummary, reversePayment } from '@/lib/reconciliation-api';

type ApiRecord = Record<string, unknown>;

const asRecord = (value: unknown): ApiRecord => (value && typeof value === 'object' ? value as ApiRecord : {});
const text = (value: unknown) => value == null ? '—' : String(value);
const money = (value: unknown) => Number(value ?? 0).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 });
const dateToday = () => new Date().toISOString().slice(0, 10);

export default function PaymentLedgerPage() {
  const { accessToken } = useAuth();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [merchantId, setMerchantId] = useState(() => searchParams.get('merchantId') ?? '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [summaryDate, setSummaryDate] = useState(dateToday);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const schoolsQuery = useQuery({
    queryKey: ['school-payment-ledger-merchants'],
    queryFn: () => listMerchants(accessToken!, 1, 100),
    enabled: !!accessToken,
  });
  const schools = (schoolsQuery.data?.data ?? []).filter((merchant) => merchant.isSchool);
  const ledgerQuery = useQuery({
    queryKey: ['school-payment-ledger', merchantId, dateFrom, dateTo, status, channel, search],
    queryFn: () => listSchoolPaymentLedger(accessToken!, merchantId, { dateFrom, dateTo, status, channel, search }),
    enabled: !!accessToken && !!merchantId,
  });
  const detailQuery = useQuery({
    queryKey: ['school-payment-ledger-detail', merchantId, selectedPaymentId],
    queryFn: () => getPaymentLedgerDetail(accessToken!, merchantId, selectedPaymentId),
    enabled: !!accessToken && !!merchantId && !!selectedPaymentId,
  });
  const summaryQuery = useQuery({
    queryKey: ['school-payment-ledger-summary', merchantId, summaryDate],
    queryFn: () => paymentDailySummary(accessToken!, merchantId, summaryDate),
    enabled: !!accessToken && !!merchantId && !!summaryDate,
  });

  const ledgerResult = ledgerQuery.data;
  const payments = Array.isArray(ledgerResult) ? ledgerResult : (ledgerResult?.data ?? []);
  const detail = asRecord(detailQuery.data);
  const summary = asRecord(summaryQuery.data);

  async function run(action: () => Promise<unknown>, message: string) {
    setError(null);
    try {
      await action();
      setSuccess(message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-payment-ledger'] }),
        queryClient.invalidateQueries({ queryKey: ['school-payment-ledger-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['school-payment-ledger-summary'] }),
      ]);
      setReverseReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Ledger" description="Review school fee payments, allocation records, and reversals." />
      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess(null)}>{success}</Alert>}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-base"><BookOpenCheck className="h-5 w-5" /> School payment ledger</CardTitle><CardDescription>Select a school to inspect its recorded payments.</CardDescription></div>
          <Select className="w-72" value={merchantId} onChange={(event) => { setMerchantId(event.target.value); setSelectedPaymentId(''); }}>
            <option value="">Select school…</option>
            {schools.map((school) => <option key={school.id} value={school.id}>{school.tradingName}</option>)}
          </Select>
        </CardHeader>
      </Card>

      {merchantId && <>
        <Card>
          <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Input type="date" aria-label="From date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <Input type="date" aria-label="To date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="COMPLETED">Completed</option><option value="PENDING">Pending</option><option value="REVERSED">Reversed</option><option value="FAILED">Failed</option></Select>
            <Select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="">All channels</option><option value="TIPS">TIPS</option><option value="CBS">CBS</option><option value="CASH">Cash</option><option value="MOCK">Mock</option></Select>
            <Input className="lg:col-span-2" placeholder="Search reference or student…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader><CardTitle className="text-base">Payments</CardTitle><CardDescription>{ledgerQuery.isLoading ? 'Loading payments…' : `${payments.length} payment${payments.length === 1 ? '' : 's'} returned`}</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Student</TableHead><TableHead>Amount</TableHead><TableHead>Channel</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>
                {payments.map((item, index) => { const payment = asRecord(item); const id = text(payment.id ?? payment.paymentId); return <TableRow className="cursor-pointer" key={id === '—' ? index : id} onClick={() => setSelectedPaymentId(id === '—' ? '' : id)}><TableCell className="font-mono text-xs">{text(payment.reference ?? payment.paymentReference ?? payment.id)}</TableCell><TableCell>{text(payment.studentName ?? asRecord(payment.student).fullName)}</TableCell><TableCell>{money(payment.amount)}</TableCell><TableCell>{text(payment.channel ?? payment.paymentChannel)}</TableCell><TableCell><Badge variant={statusBadgeVariant(text(payment.status))}>{text(payment.status)}</Badge></TableCell><TableCell>{text(payment.paidAt ?? payment.createdAt ?? payment.paymentDate)}</TableCell></TableRow>; })}
                {!ledgerQuery.isLoading && !payments.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No payments match these filters.</TableCell></TableRow>}
              </TableBody></Table>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card><CardHeader><CardTitle className="text-base">Daily summary</CardTitle><CardDescription>Totals for the selected school and date.</CardDescription></CardHeader><CardContent className="space-y-4"><Input type="date" value={summaryDate} onChange={(event) => setSummaryDate(event.target.value)} />{summaryQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading summary…</p> : <dl className="space-y-3 text-sm">{Object.entries(summary).length ? Object.entries(summary).map(([key, value]) => <div className="flex justify-between gap-4" key={key}><dt className="text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className="font-medium">{typeof value === 'number' && /amount|total|value|collected/i.test(key) ? money(value) : text(value)}</dd></div>) : <p className="text-muted-foreground">No summary is available.</p>}</dl>}</CardContent></Card>
            {selectedPaymentId && <Card><CardHeader><CardTitle className="text-base">Payment detail</CardTitle><CardDescription>{detailQuery.isLoading ? 'Loading payment…' : text(detail.reference ?? detail.paymentReference ?? selectedPaymentId)}</CardDescription></CardHeader><CardContent className="space-y-4">{Object.keys(detail).length > 0 && <><DetailList title="Payment" data={detail} /><DetailList title="Allocations" data={detail.allocations} /><DetailList title="Lifecycle" data={detail.lifecycle ?? detail.events} /><div className="space-y-2 border-t border-border pt-4"><Input placeholder="Reason for reversal" value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} /><Button variant="destructive" disabled={!reverseReason} onClick={() => void run(() => reversePayment(accessToken!, merchantId, selectedPaymentId, reverseReason), 'Payment reversed.')}>Reverse payment</Button></div></>}</CardContent></Card>}
          </div>
        </div>
      </>}
      {!merchantId && !schoolsQuery.isLoading && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Choose a school merchant to view its payment ledger.</CardContent></Card>}
    </div>
  );
}

function DetailList({ title, data }: { title: string; data: unknown }) {
  if (data == null) return null;
  const values = Array.isArray(data) ? data : Object.entries(asRecord(data)).map(([key, value]) => ({ key, value }));
  if (!values.length) return null;
  return <div><p className="mb-2 text-sm font-medium">{title}</p><div className="space-y-1 text-xs text-muted-foreground">{values.map((item, index) => <p key={index}>{typeof item === 'object' && item && 'key' in item ? `${text(asRecord(item).key)}: ${text(asRecord(item).value)}` : JSON.stringify(item)}</p>)}</div></div>;
}
