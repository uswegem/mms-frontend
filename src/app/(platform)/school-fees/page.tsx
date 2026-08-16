'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ReceiptText, School } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listMerchants } from '@/lib/merchants-api';
import {
  PAYMENT_CHANNELS,
  amendFeeStructure,
  adjustFeeInvoice,
  archiveFeeStructure,
  asAmount,
  cancelFeeInvoice,
  collectSchoolFeePayment,
  createAcademicYear,
  createClassLevel,
  createFeeStructure,
  createTerm,
  downloadPaymentSlip,
  enrollRegistryStudent,
  generateClassFeeInvoices,
  generateFeeInvoice,
  getClassTermTotals,
  getFeeInvoice,
  getStudentStatement,
  invoiceStatusLabel,
  listAcademicYears,
  listClassLevels,
  listFeeInvoices,
  listFeeStructures,
  listRegistryStudents,
  listTerms,
  moneyAmount,
  publishFeeStructure,
  type FeeInvoice,
  type FeeItem,
  type FeePaymentChannel,
} from '@/lib/school-fees-api';

const FEE_QUERY_KEYS = [
  'school-fee-invoices',
  'school-fee-invoice',
  'school-fee-totals',
  'school-fee-statement',
] as const;

export default function SchoolFeesPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [merchantId, setMerchantId] = useState('');
  const [activeTab, setActiveTab] = useState('academic');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [yearName, setYearName] = useState('');
  const [termName, setTermName] = useState('');
  const [termYearId, setTermYearId] = useState('');
  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [feeName, setFeeName] = useState('');
  const [feeYearId, setFeeYearId] = useState('');
  const [feeTermId, setFeeTermId] = useState('');
  const [feeClassId, setFeeClassId] = useState('');
  const [feeItems, setFeeItems] = useState<FeeItem[]>([{ code: 'TUITION', name: 'Tuition', amount: '' }]);
  const [studentYearId, setStudentYearId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [invoiceClassId, setInvoiceClassId] = useState('');
  const [invoiceTermId, setInvoiceTermId] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [invoiceReason, setInvoiceReason] = useState('');

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [collectInvoiceId, setCollectInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState<FeePaymentChannel>('BANK_BRANCH');
  const [generateTermId, setGenerateTermId] = useState('');
  const [paymentFieldError, setPaymentFieldError] = useState<string | null>(null);

  const schoolsQuery = useQuery({
    queryKey: ['school-fee-merchants'],
    queryFn: () => listMerchants(accessToken!, 1, 100),
    enabled: !!accessToken,
  });
  const schools = (schoolsQuery.data?.data ?? []).filter((merchant) => merchant.isSchool);

  const yearsQuery = useQuery({ queryKey: ['school-fee-years', merchantId], queryFn: () => listAcademicYears(accessToken!, merchantId), enabled: !!accessToken && !!merchantId });
  const termsQuery = useQuery({ queryKey: ['school-fee-terms', merchantId], queryFn: () => listTerms(accessToken!, merchantId), enabled: !!accessToken && !!merchantId });
  const classesQuery = useQuery({ queryKey: ['school-fee-classes', merchantId], queryFn: () => listClassLevels(accessToken!, merchantId), enabled: !!accessToken && !!merchantId });
  const structuresQuery = useQuery({ queryKey: ['school-fee-structures', merchantId], queryFn: () => listFeeStructures(accessToken!, merchantId), enabled: !!accessToken && !!merchantId });
  const studentsQuery = useQuery({
    queryKey: ['school-fee-registry', merchantId, studentSearch],
    queryFn: () => listRegistryStudents(accessToken!, merchantId, {
      search: studentSearch || undefined,
    }),
    enabled: !!accessToken && !!merchantId,
  });
  const invoicesQuery = useQuery({
    queryKey: ['school-fee-invoices', merchantId, invoiceClassId, invoiceTermId, invoiceStatus, invoiceSearch],
    queryFn: () => listFeeInvoices(accessToken!, merchantId, {
      classLevelId: invoiceClassId || undefined,
      academicTermId: invoiceTermId || undefined,
      status: invoiceStatus || undefined,
      search: invoiceSearch || undefined,
    }),
    enabled: !!accessToken && !!merchantId,
  });
  const totalsQuery = useQuery({
    queryKey: ['school-fee-totals', merchantId, invoiceClassId, invoiceTermId],
    queryFn: () => getClassTermTotals(accessToken!, merchantId, invoiceClassId, invoiceTermId),
    enabled: !!accessToken && !!merchantId && !!invoiceClassId && !!invoiceTermId,
  });
  const detailQuery = useQuery({
    queryKey: ['school-fee-invoice', merchantId, selectedInvoiceId],
    queryFn: () => getFeeInvoice(accessToken!, merchantId, selectedInvoiceId),
    enabled: !!accessToken && !!merchantId && !!selectedInvoiceId,
  });
  const statementQuery = useQuery({
    queryKey: ['school-fee-statement', merchantId, selectedStudentId],
    queryFn: () => getStudentStatement(accessToken!, merchantId, selectedStudentId),
    enabled: !!accessToken && !!merchantId && !!selectedStudentId,
  });

  const years = yearsQuery.data ?? [];
  const terms = termsQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const students = studentsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const statement = statementQuery.data ?? [];
  const collectInvoice = statement.find((invoice) => invoice.id === collectInvoiceId);
  const openInvoices = statement.filter((invoice) => invoice.status === 'UNPAID' || invoice.status === 'PARTIALLY_PAID');
  const statementTotals = useMemo(() => {
    return statement.reduce(
      (acc, invoice) => {
        if (invoice.status === 'CANCELLED') return acc;
        acc.total += asAmount(invoice.totalAmount);
        acc.paid += asAmount(invoice.amountPaid);
        acc.outstanding += asAmount(invoice.outstandingBalance);
        acc.discounts += asAmount(invoice.adjustmentAmount);
        return acc;
      },
      { total: 0, paid: 0, outstanding: 0, discounts: 0 },
    );
  }, [statement]);

  const refresh = async (...keys: string[]) => {
    await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  };
  const run = async (action: () => Promise<unknown>, message: string, refreshKeys: string[]) => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await action();
      setSuccess(message);
      await refresh(...refreshKeys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  function resetSchool(id: string) {
    setMerchantId(id);
    setSelectedInvoiceId('');
    setSelectedStudentId('');
    setCollectInvoiceId('');
    setPaymentAmount('');
    setPaymentFieldError(null);
  }

  function submitYear(event: FormEvent) {
    event.preventDefault();
    void run(() => createAcademicYear(accessToken!, merchantId, { name: yearName, isCurrent: years.length === 0 }), 'Academic year created.', ['school-fee-years']).then(() => setYearName(''));
  }
  function submitTerm(event: FormEvent) {
    event.preventDefault();
    void run(() => createTerm(accessToken!, merchantId, { name: termName, academicYearId: termYearId }), 'Term created.', ['school-fee-terms']).then(() => setTermName(''));
  }
  function submitClass(event: FormEvent) {
    event.preventDefault();
    void run(() => createClassLevel(accessToken!, merchantId, { code: classCode, name: className }), 'Class level created.', ['school-fee-classes']).then(() => { setClassCode(''); setClassName(''); });
  }
  function submitStructure(event: FormEvent) {
    event.preventDefault();
    const items = feeItems.map((item) => ({
      ...item,
      code: item.code.trim(),
      name: item.name.trim(),
      amount: String(item.amount).trim(),
    }));
    void run(
      () => createFeeStructure(accessToken!, merchantId, {
        name: feeName.trim(),
        academicYearId: feeYearId,
        academicTermId: feeTermId,
        classLevelId: feeClassId,
        items,
      }),
      'Fee structure saved as draft.',
      ['school-fee-structures'],
    ).then(() => { setFeeName(''); setFeeItems([{ code: 'TUITION', name: 'Tuition', amount: '' }]); });
  }

  function openCollectForInvoice(invoice: FeeInvoice) {
    const studentId = invoice.student?.id;
    if (studentId) setSelectedStudentId(studentId);
    setCollectInvoiceId(invoice.id);
    setPaymentAmount(String(asAmount(invoice.outstandingBalance) || ''));
    setPaymentFieldError(null);
    setActiveTab('payments');
  }

  function validatePayment(): string | null {
    if (!selectedStudentId) return 'Select a student first.';
    if (!collectInvoiceId) return 'Select an invoice to pay.';
    if (!collectInvoice?.paymentReference) return 'This invoice has no payment reference.';
    if (collectInvoice.status === 'PAID') return 'This invoice is already fully paid.';
    if (collectInvoice.status === 'CANCELLED') return 'Cancelled invoices cannot be paid.';
    if (!paymentAmount.trim()) return 'Enter a payment amount.';
    if (!/^\d+(\.\d{1,2})?$/.test(paymentAmount.trim())) return 'Amount must be a positive number with up to 2 decimal places.';
    if (Number(paymentAmount) <= 0) return 'Payment amount must be greater than zero.';
    if (!paymentChannel) return 'Select a payment method.';
    return null;
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const validation = validatePayment();
    if (validation) {
      setPaymentFieldError(validation);
      setError(validation);
      return;
    }
    setPaymentFieldError(null);
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await collectSchoolFeePayment(accessToken!, {
        paymentReference: collectInvoice!.paymentReference!,
        amount: paymentAmount.trim(),
        channel: paymentChannel,
      });
      if (result.duplicate) {
        throw new Error('This payment was already recorded. Refresh the invoice before trying again.');
      }
      if (result.applied === false) {
        throw new Error(result.status ? `Payment was not applied (${result.status}).` : 'Payment was not applied.');
      }
      const overpay = asAmount(result.overpayment);
      setPaymentAmount('');
      setSuccess(
        overpay > 0
          ? `Payment recorded. Overpayment of ${moneyAmount(overpay)} was credited to the student account.`
          : 'Payment recorded. Balance and status have been refreshed.',
      );
      await refresh(...FEE_QUERY_KEYS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="School Fee Collection"
        description="Academic setup, fees, student registry, invoicing, and payment collection."
      />
      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess(null)}>{success}</Alert>}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><School className="h-5 w-5" /> School workspace</CardTitle>
            <CardDescription>Select an approved school to manage its fee collection cycle.</CardDescription>
          </div>
          <Select className="w-72" value={merchantId} onChange={(event) => resetSchool(event.target.value)}>
            <option value="">Select school…</option>
            {schools.map((school) => <option key={school.id} value={school.id}>{school.tradingName}</option>)}
          </Select>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 border-t border-border pt-5">
          <Link href="/onboarding"><Button variant="outline">Start School Onboarding</Button></Link>
          <Link href="/merchants"><Button variant="ghost">View Merchants / Schools</Button></Link>
        </CardContent>
      </Card>

      {schoolsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading schools…</p>}
      {!merchantId && !schoolsQuery.isLoading && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {schools.length ? 'Select a school to continue.' : 'No school merchants are available. Complete the Milestone 2 onboarding flow first.'}
        </CardContent></Card>
      )}

      {merchantId && (
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="academic">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="academic">Academic</TabsTrigger>
            <TabsTrigger value="structures">Fee Structures</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Collect payment</TabsTrigger>
          </TabsList>

          <TabsContent value="academic" className="grid gap-6 lg:grid-cols-3">
            <SetupCard title="Academic years" description="Create the school calendar." onSubmit={submitYear} buttonLabel="Add year" disabled={busy}>
              <Input required placeholder="2026 / 2027" value={yearName} onChange={(event) => setYearName(event.target.value)} />
            </SetupCard>
            <SetupCard title="Terms" description="Terms belong to one academic year." onSubmit={submitTerm} buttonLabel="Add term" disabled={busy}>
              <Select required value={termYearId} onChange={(event) => setTermYearId(event.target.value)}><option value="">Academic year…</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</Select>
              <Input required placeholder="Term 1" value={termName} onChange={(event) => setTermName(event.target.value)} />
            </SetupCard>
            <SetupCard title="Class levels" description="Used for enrolments and bulk invoices." onSubmit={submitClass} buttonLabel="Add class" disabled={busy}>
              <Input required placeholder="Code (e.g. STD-1)" value={classCode} onChange={(event) => setClassCode(event.target.value)} />
              <Input required placeholder="Name (e.g. Standard 1)" value={className} onChange={(event) => setClassName(event.target.value)} />
            </SetupCard>
            <Card className="lg:col-span-3"><CardContent className="grid gap-6 py-5 md:grid-cols-3">
              {yearsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading academic setup…</p> : <>
                <DefinitionList title="Academic years" values={years.map((year) => `${year.name}${year.isCurrent ? ' · Current' : ''}`)} />
                <DefinitionList title="Terms" values={terms.map((term) => term.name)} />
                <DefinitionList title="Class levels" values={classes.map((level) => `${level.code} · ${level.name}`)} />
              </>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="structures" className="space-y-6">
            <Card><CardHeader><CardTitle className="text-base">Create fee structure draft</CardTitle><CardDescription>Each item becomes an invoice line when the structure is published.</CardDescription></CardHeader><CardContent>
              <form className="space-y-4" onSubmit={submitStructure}>
                <div className="grid gap-3 md:grid-cols-4">
                  <Input required placeholder="Structure name" value={feeName} onChange={(event) => setFeeName(event.target.value)} />
                  <Select required value={feeYearId} onChange={(event) => { setFeeYearId(event.target.value); setFeeTermId(''); }}>
                    <option value="">Academic year…</option>
                    {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                  </Select>
                  <Select required value={feeTermId} onChange={(event) => setFeeTermId(event.target.value)}>
                    <option value="">{feeYearId ? 'Term…' : 'Select year first…'}</option>
                    {terms.filter((term) => !feeYearId || term.academicYearId === feeYearId).map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                  </Select>
                  <Select required value={feeClassId} onChange={(event) => setFeeClassId(event.target.value)}><option value="">Class…</option>{classes.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</Select>
                </div>
                {feeItems.map((item, index) => <div className="grid gap-2 md:grid-cols-[1fr_2fr_1fr_auto]" key={index}>
                  <Input required placeholder="Code" value={item.code} onChange={(event) => setFeeItems((items) => items.map((current, i) => i === index ? { ...current, code: event.target.value } : current))} />
                  <Input required placeholder="Fee item" value={item.name} onChange={(event) => setFeeItems((items) => items.map((current, i) => i === index ? { ...current, name: event.target.value } : current))} />
                  <Input required min="0" step="0.01" type="number" placeholder="Amount" value={String(item.amount)} onChange={(event) => setFeeItems((items) => items.map((current, i) => i === index ? { ...current, amount: event.target.value } : current))} />
                  <Button type="button" variant="ghost" disabled={feeItems.length === 1} onClick={() => setFeeItems((items) => items.filter((_, i) => i !== index))}>Remove</Button>
                </div>)}
                <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setFeeItems((items) => [...items, { code: '', name: '', amount: '' }])}>Add item</Button><Button type="submit" disabled={busy}>Save draft</Button></div>
              </form>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Fee structures</CardTitle></CardHeader><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Items</TableHead><TableHead /></TableRow></TableHeader><TableBody>
                {(structuresQuery.data ?? []).map((structure) => <TableRow key={structure.id}><TableCell>{structure.name}</TableCell><TableCell><Badge variant={statusBadgeVariant(structure.status)}>{structure.status}</Badge></TableCell><TableCell>{structure.items.length}</TableCell><TableCell className="space-x-2 text-right">
                  {structure.status === 'DRAFT' && <Button size="sm" disabled={busy} onClick={() => void run(() => publishFeeStructure(accessToken!, merchantId, structure.id), 'Fee structure published.', ['school-fee-structures'])}>Publish</Button>}
                  {structure.status === 'PUBLISHED' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => amendFeeStructure(accessToken!, merchantId, structure.id), 'Amendment draft created.', ['school-fee-structures'])}>Amend</Button>}
                  {structure.status !== 'ARCHIVED' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => archiveFeeStructure(accessToken!, merchantId, structure.id), 'Fee structure archived.', ['school-fee-structures'])}>Archive</Button>}
                </TableCell></TableRow>)}
                {!structuresQuery.isLoading && !(structuresQuery.data ?? []).length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No fee structures yet.</TableCell></TableRow>}
              </TableBody></Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Student registry</CardTitle>
                  <CardDescription>Pick the year first, then choose a class on the student row to enroll them. Unenrolled students stay in this list.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input className="w-56" placeholder="Search name or admission no." value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} />
                  <Select className="w-52" value={studentYearId} onChange={(event) => setStudentYearId(event.target.value)}>
                    <option value="">Enroll into year…</option>
                    {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission no.</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Lipa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Current class</TableHead>
                      <TableHead>Enroll</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => {
                      const current = student.enrollments?.[0];
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-mono text-xs">{student.admissionNo}</TableCell>
                          <TableCell>
                            <div>{student.fullName}</div>
                            <div className="text-xs text-muted-foreground">{student.guardianPhone}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{student.studentAlias?.alias8digit ?? '—'}</TableCell>
                          <TableCell><Badge variant={statusBadgeVariant(student.status)}>{student.status}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {current ? `${current.academicYear?.name ?? ''} · ${current.classLevel?.name ?? ''}` : 'Not enrolled'}
                          </TableCell>
                          <TableCell>
                            <Select
                              className="w-40"
                              defaultValue=""
                              disabled={!studentYearId || busy}
                              onChange={(event) => {
                                const classLevelId = event.target.value;
                                if (classLevelId && studentYearId) {
                                  void run(
                                    () => enrollRegistryStudent(accessToken!, merchantId, student.id, { academicYearId: studentYearId, classLevelId }),
                                    `${student.fullName} enrolled.`,
                                    ['school-fee-registry'],
                                  );
                                }
                              }}
                            >
                              <option value="">Choose class…</option>
                              {classes.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedStudentId(student.id); setCollectInvoiceId(''); setActiveTab('payments'); }}>Collect fees</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {studentsQuery.isLoading && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading students…</TableCell></TableRow>}
                    {!studentsQuery.isLoading && !students.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No students found. Add them from Merchants → Students first.</TableCell></TableRow>}
                  </TableBody>
                </Table>
                {!studentYearId
                  ? <p className="p-4 text-xs text-muted-foreground">Select <span className="font-medium">Enroll into year</span> (for example 2026), then choose Standard 1 on the student row.</p>
                  : <p className="p-4 text-xs text-muted-foreground">Year {years.find((year) => year.id === studentYearId)?.name} is selected. Choose a class on the student row to enroll.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <Card><CardHeader className="flex-row flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Invoices</CardTitle><CardDescription>Generate class invoices and follow collection progress.</CardDescription></div><div className="flex flex-wrap gap-2"><Select className="w-44" value={invoiceClassId} onChange={(event) => setInvoiceClassId(event.target.value)}><option value="">All classes</option>{classes.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</Select><Select className="w-36" value={invoiceTermId} onChange={(event) => setInvoiceTermId(event.target.value)}><option value="">All terms</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</Select><Select className="w-40" value={invoiceStatus} onChange={(event) => setInvoiceStatus(event.target.value)}><option value="">All statuses</option><option value="UNPAID">Unpaid</option><option value="PARTIALLY_PAID">Partially Paid</option><option value="PAID">Paid</option><option value="CANCELLED">Cancelled</option></Select><Button disabled={!invoiceClassId || !invoiceTermId || busy} onClick={() => void run(() => generateClassFeeInvoices(accessToken!, merchantId, { classLevelId: invoiceClassId, academicTermId: invoiceTermId }), 'Class invoice generation started.', ['school-fee-invoices', 'school-fee-totals', 'school-fee-statement'])}>Generate class</Button></div></CardHeader>
              {invoiceClassId && invoiceTermId && (
                <CardContent className="grid grid-cols-2 gap-4 border-y border-border py-4 md:grid-cols-4">
                  {totalsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading totals…</p> : <>
                    <Metric label="Invoiced" value={moneyAmount(totalsQuery.data?.total)} />
                    <Metric label="Collected" value={moneyAmount(totalsQuery.data?.collected)} />
                    <Metric label="Outstanding" value={moneyAmount(totalsQuery.data?.outstanding)} />
                    <Metric label="Invoices" value={String(totalsQuery.data?.invoiceCount ?? 0)} />
                  </>}
                </CardContent>
              )}
              <CardContent className="p-0"><div className="p-4"><Input className="max-w-sm" placeholder="Search student, admission no., or invoice…" value={invoiceSearch} onChange={(event) => setInvoiceSearch(event.target.value)} /></div><Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Student</TableHead><TableHead>Status</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Outstanding</TableHead><TableHead /></TableRow></TableHeader><TableBody>
                {invoices.map((invoice) => <TableRow key={invoice.id}><TableCell className="font-mono text-xs">{invoice.invoiceNumber ?? invoice.id.slice(0, 8)}</TableCell><TableCell>{invoice.student?.fullName ?? '—'}</TableCell><TableCell><Badge variant={statusBadgeVariant(invoice.status)}>{invoiceStatusLabel(invoice.status)}</Badge></TableCell><TableCell>{moneyAmount(invoice.totalAmount)}</TableCell><TableCell>{moneyAmount(invoice.amountPaid)}</TableCell><TableCell>{moneyAmount(invoice.outstandingBalance)}</TableCell><TableCell className="space-x-1 text-right"><Button size="sm" variant="ghost" onClick={() => setSelectedInvoiceId(invoice.id)}>View</Button><Button size="sm" variant="outline" disabled={invoice.status === 'PAID' || invoice.status === 'CANCELLED'} onClick={() => openCollectForInvoice(invoice)}>Collect</Button></TableCell></TableRow>)}
                {invoicesQuery.isLoading && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading invoices…</TableCell></TableRow>}
                {!invoicesQuery.isLoading && !invoices.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No invoices found.</TableCell></TableRow>}
              </TableBody></Table></CardContent>
            </Card>

            {selectedInvoiceId && (
              <InvoiceDetailCard
                invoice={detailQuery.data}
                loading={detailQuery.isLoading}
                busy={busy}
                reason={invoiceReason}
                onReasonChange={setInvoiceReason}
                onCollect={() => detailQuery.data && openCollectForInvoice(detailQuery.data)}
                onReceipt={() => void run(() => downloadPaymentSlip(accessToken!, merchantId, selectedInvoiceId), 'Payment slip downloaded.', [])}
                onCancel={() => void run(() => cancelFeeInvoice(accessToken!, merchantId, selectedInvoiceId, invoiceReason), 'Invoice cancelled.', [...FEE_QUERY_KEYS])}
                onWaive={() => void run(() => adjustFeeInvoice(accessToken!, merchantId, selectedInvoiceId, { type: 'WAIVER', reason: invoiceReason, percentOff: '100' }), 'Invoice waived.', [...FEE_QUERY_KEYS])}
              />
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Collect a fee payment</CardTitle>
                <CardDescription>Select a student, review their invoices, then record a payment against the invoice control number.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Select value={selectedStudentId} onChange={(event) => { setSelectedStudentId(event.target.value); setCollectInvoiceId(''); setPaymentAmount(''); setPaymentFieldError(null); }}>
                  <option value="">Select student…</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.fullName} · {student.admissionNo}</option>)}
                </Select>
                <Input placeholder="Filter students by name or admission no." value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} />
              </CardContent>
            </Card>

            {selectedStudentId && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{selectedStudent?.fullName ?? collectInvoice?.student?.fullName ?? 'Student'}</CardTitle>
                    <CardDescription>
                      Admission {selectedStudent?.admissionNo ?? '—'}
                      {selectedStudent?.studentAlias?.alias8digit ? ` · Lipa ${selectedStudent.studentAlias.alias8digit}` : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Metric label="Invoiced" value={moneyAmount(statementTotals.total)} />
                    <Metric label="Paid" value={moneyAmount(statementTotals.paid)} />
                    <Metric label="Outstanding" value={moneyAmount(statementTotals.outstanding)} />
                    <Metric label="Discounts / waivers" value={moneyAmount(statementTotals.discounts)} />
                  </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                  <Card>
                    <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">Fee statement</CardTitle>
                        <CardDescription>Open invoices and payment history for this student.</CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Select className="w-40" value={generateTermId} onChange={(event) => setGenerateTermId(event.target.value)}>
                          <option value="">Term to invoice…</option>
                          {terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                        </Select>
                        <Button size="sm" variant="outline" disabled={!generateTermId || busy} onClick={() => void run(() => generateFeeInvoice(accessToken!, merchantId, { studentId: selectedStudentId, academicTermId: generateTermId }), 'Invoice generated for this student.', [...FEE_QUERY_KEYS])}>Generate invoice</Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {statementQuery.isLoading && <p className="p-5 text-sm text-muted-foreground">Loading statement…</p>}
                      {!statementQuery.isLoading && !statement.length && <p className="p-5 text-sm text-muted-foreground">No invoices yet for this student. Generate one for a term that has a published fee structure.</p>}
                      {statement.map((invoice) => (
                        <div key={invoice.id} className={`border-t border-border p-4 ${collectInvoiceId === invoice.id ? 'bg-muted/40' : ''}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-sm">{invoice.invoiceNumber}</p>
                              <p className="text-xs text-muted-foreground">{invoice.academicTerm?.name ?? 'Term'} · Control {invoice.paymentReference ?? '—'}</p>
                            </div>
                            <Badge variant={statusBadgeVariant(invoice.status)}>{invoiceStatusLabel(invoice.status)}</Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                            <span>Total {moneyAmount(invoice.totalAmount)}</span>
                            <span>Paid {moneyAmount(invoice.amountPaid)}</span>
                            <span>Outstanding {moneyAmount(invoice.outstandingBalance)}</span>
                            <span>Discount {moneyAmount(invoice.adjustmentAmount)}</span>
                          </div>
                          {!!invoice.lines?.length && <ul className="mt-2 text-xs text-muted-foreground">{invoice.lines.map((line) => <li key={line.id ?? line.code}>{line.name}: {moneyAmount(line.amount)}</li>)}</ul>}
                          {!!invoice.payments?.length && (
                            <div className="mt-3 text-sm">
                              <p className="mb-1 font-medium">Payment history</p>
                              {invoice.payments.map((payment) => (
                                <p key={payment.id}>{moneyAmount(payment.amount)} · {payment.channel ?? '—'} · {payment.status ?? '—'} · {payment.paidAt ? new Date(payment.paidAt).toLocaleString() : '—'} · {payment.gatewayTxnRef ?? payment.id}</p>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant={collectInvoiceId === invoice.id ? 'default' : 'outline'} disabled={invoice.status === 'CANCELLED'} onClick={() => { setCollectInvoiceId(invoice.id); setPaymentAmount(invoice.status === 'PAID' ? '' : String(asAmount(invoice.outstandingBalance) || '')); setPaymentFieldError(null); }}>
                              {invoice.status === 'PAID' ? 'Select (paid)' : 'Select to pay'}
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => downloadPaymentSlip(accessToken!, merchantId, invoice.id), 'Payment slip downloaded.', [])}>Receipt / slip</Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Record payment</CardTitle>
                      <CardDescription>
                        {collectInvoice
                          ? `${collectInvoice.invoiceNumber} · outstanding ${moneyAmount(collectInvoice.outstandingBalance)}`
                          : 'Choose an invoice from the statement.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-3" onSubmit={(event) => void submitPayment(event)}>
                        <Select value={collectInvoiceId} onChange={(event) => {
                          const next = statement.find((invoice) => invoice.id === event.target.value);
                          setCollectInvoiceId(event.target.value);
                          setPaymentAmount(next && next.status !== 'PAID' ? String(asAmount(next.outstandingBalance) || '') : '');
                          setPaymentFieldError(null);
                        }}>
                          <option value="">Select invoice…</option>
                          {statement.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {invoiceStatusLabel(invoice.status)} · {moneyAmount(invoice.outstandingBalance)} due</option>)}
                        </Select>
                        <Input
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Amount"
                          value={paymentAmount}
                          onChange={(event) => { setPaymentAmount(event.target.value); setPaymentFieldError(null); }}
                          disabled={!collectInvoice || collectInvoice.status === 'PAID' || collectInvoice.status === 'CANCELLED'}
                        />
                        <Select value={paymentChannel} onChange={(event) => setPaymentChannel(event.target.value as FeePaymentChannel)}>
                          {PAYMENT_CHANNELS.map((channel) => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
                        </Select>
                        {paymentFieldError && <p className="text-sm text-destructive">{paymentFieldError}</p>}
                        {collectInvoice?.status === 'PAID' && <p className="text-sm text-muted-foreground">This invoice is already fully paid.</p>}
                        {collectInvoice?.status === 'PARTIALLY_PAID' && <p className="text-sm text-muted-foreground">{openInvoices.length} open invoice{openInvoices.length === 1 ? '' : 's'} remaining for this student.</p>}
                        <Button type="submit" disabled={busy || !collectInvoice || collectInvoice.status === 'PAID' || collectInvoice.status === 'CANCELLED'}>
                          {busy ? 'Submitting…' : 'Submit payment'}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
            {!selectedStudentId && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Select a student to view fee details and collect a payment.</CardContent></Card>}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function InvoiceDetailCard({
  invoice,
  loading,
  busy,
  reason,
  onReasonChange,
  onCollect,
  onReceipt,
  onCancel,
  onWaive,
}: {
  invoice?: FeeInvoice;
  loading: boolean;
  busy: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onCollect: () => void;
  onReceipt: () => void;
  onCancel: () => void;
  onWaive: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ReceiptText className="h-4 w-4" /> Invoice {invoice?.invoiceNumber ?? '…'}
        </CardTitle>
        <CardDescription>
          {loading ? 'Loading invoice…' : `${invoice?.student?.fullName ?? '—'} · Control ${invoice?.paymentReference ?? '—'}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading invoice detail…</p>}
        {invoice && <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusBadgeVariant(invoice.status)}>{invoiceStatusLabel(invoice.status)}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Subtotal" value={moneyAmount(invoice.subtotalAmount)} />
            <Metric label="Discounts / waivers" value={moneyAmount(invoice.adjustmentAmount)} />
            <Metric label="Total due" value={moneyAmount(invoice.totalAmount)} />
            <Metric label="Paid" value={moneyAmount(invoice.amountPaid)} />
            <Metric label="Outstanding" value={moneyAmount(invoice.outstandingBalance)} />
          </div>
          {!!invoice.lines?.length && <div className="text-sm"><p className="mb-1 font-medium">Fee items</p>{invoice.lines.map((line) => <p key={line.id ?? line.code}>{line.name}: {moneyAmount(line.amount)}</p>)}</div>}
          {!!invoice.adjustments?.length && <div className="text-sm"><p className="mb-1 font-medium">Adjustments</p>{invoice.adjustments.map((item) => <p key={item.id}>{item.type} · {moneyAmount(item.amountOff)} · {item.reason}</p>)}</div>}
          <div className="text-sm">
            <p className="mb-1 font-medium">Payments</p>
            {invoice.payments?.length
              ? invoice.payments.map((payment) => <p key={payment.id}>{moneyAmount(payment.amount)} · {payment.channel ?? '—'} · {payment.paymentReference ?? payment.gatewayTxnRef ?? payment.id} · {payment.paidAt ? new Date(payment.paidAt).toLocaleString() : '—'}</p>)
              : <p className="text-muted-foreground">No payments recorded.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onCollect} disabled={invoice.status === 'PAID' || invoice.status === 'CANCELLED'}>Collect payment</Button>
            <Button variant="outline" disabled={busy} onClick={onReceipt}>Download slip</Button>
            <Input className="w-64" placeholder="Reason for waiver or cancellation" value={reason} onChange={(event) => onReasonChange(event.target.value)} />
            <Button variant="outline" disabled={!reason || busy || asAmount(invoice.amountPaid) > 0} onClick={onCancel}>Cancel</Button>
            <Button variant="outline" disabled={!reason || busy || invoice.status === 'CANCELLED'} onClick={onWaive}>Waive balance</Button>
          </div>
        </>}
      </CardContent>
    </Card>
  );
}

function SetupCard({ title, description, onSubmit, buttonLabel, disabled, children }: { title: string; description: string; onSubmit: (event: FormEvent) => void; buttonLabel: string; disabled?: boolean; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={onSubmit}>{children}<Button type="submit" disabled={disabled}>{buttonLabel}</Button></form></CardContent></Card>;
}

function DefinitionList({ title, values }: { title: string; values: string[] }) {
  return <div><p className="mb-2 text-sm font-medium">{title}</p>{values.length ? <ul className="space-y-1 text-sm text-muted-foreground">{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p className="text-sm text-muted-foreground">Not configured</p>}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{value}</p></div>;
}
