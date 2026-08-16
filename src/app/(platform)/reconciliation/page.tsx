'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Play, Scale, Sparkles, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { listMerchants } from '@/lib/merchants-api';
import {
  generateSimFeed,
  getReconException,
  getReconciliationRun,
  ingestSettlementCsv,
  listReconExceptions,
  listReconciliationRuns,
  resolveReconException,
  schoolReconSummary,
  startReconciliationRun,
} from '@/lib/reconciliation-api';

type ApiRecord = Record<string, unknown>;
const asRecord = (value: unknown): ApiRecord => (value && typeof value === 'object' ? (value as ApiRecord) : {});
const asList = (value: unknown) => (Array.isArray(value) ? value : []);
const text = (value: unknown) => (value === null || value === undefined ? '—' : String(value));

const RESOLVE_ACTIONS = [
  'MANUAL_MATCH',
  'FORCE_CREATE_PAYMENT',
  'BANK_SIDE_ERROR',
  'REVERSE_PAYMENT',
  'WRITE_OFF',
  'ESCALATE',
] as const;

export default function ReconciliationPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [source, setSource] = useState('');
  const [threeWay, setThreeWay] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [action, setAction] = useState<(typeof RESOLVE_ACTIONS)[number]>('BANK_SIDE_ERROR');
  const [note, setNote] = useState('');
  const [feePaymentId, setFeePaymentId] = useState('');
  const [externalId, setExternalId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const validSource = source === 'TIPS' || source === 'CBS' ? source : undefined;

  const runsQuery = useQuery({
    queryKey: ['reconciliation-runs'],
    queryFn: () => listReconciliationRuns(accessToken!),
    enabled: !!accessToken,
  });
  const runDetailQuery = useQuery({
    queryKey: ['reconciliation-run', selectedRunId],
    queryFn: () => getReconciliationRun(accessToken!, selectedRunId),
    enabled: !!accessToken && !!selectedRunId,
  });
  const exceptionsQuery = useQuery({
    queryKey: ['reconciliation-exceptions'],
    queryFn: () => listReconExceptions(accessToken!),
    enabled: !!accessToken,
  });
  const exceptionDetailQuery = useQuery({
    queryKey: ['reconciliation-exception', selectedCaseId],
    queryFn: () => getReconException(accessToken!, selectedCaseId),
    enabled: !!accessToken && !!selectedCaseId,
  });
  const schoolsQuery = useQuery({
    queryKey: ['reconciliation-schools'],
    queryFn: () => listMerchants(accessToken!, 1, 100),
    enabled: !!accessToken,
  });
  const schoolSummaryQuery = useQuery({
    queryKey: ['school-reconciliation-summary', merchantId, dateFrom, dateTo],
    queryFn: () => schoolReconSummary(accessToken!, merchantId, dateFrom, dateTo),
    enabled: !!accessToken && !!merchantId && !!dateFrom && !!dateTo,
  });

  const schools = (schoolsQuery.data?.data ?? []).filter((merchant) => merchant.isSchool);
  const runs = asList(runsQuery.data);
  const selectedRun = asRecord(runDetailQuery.data);
  const schoolSummary = asRecord(schoolSummaryQuery.data);
  const exceptions = asList(asRecord(exceptionsQuery.data).data ?? exceptionsQuery.data);
  const selectedCase = asRecord(exceptionDetailQuery.data);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['reconciliation-runs'] }),
      queryClient.invalidateQueries({ queryKey: ['reconciliation-run'] }),
      queryClient.invalidateQueries({ queryKey: ['reconciliation-exceptions'] }),
      queryClient.invalidateQueries({ queryKey: ['reconciliation-exception'] }),
      queryClient.invalidateQueries({ queryKey: ['school-reconciliation-summary'] }),
    ]);
  };

  const runAction = async (fn: () => Promise<unknown>, message: string) => {
    setError(null);
    try {
      await fn();
      setSuccess(message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  };

  const uploadFile = (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('Choose a settlement CSV file first.');
      return;
    }
    void runAction(() => ingestSettlementCsv(accessToken!, file), 'Settlement CSV uploaded.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Three-way MMS / TIPS / CBS matching, exception queue, and maker-checker resolutions."
      />
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Tabs defaultValue="runs">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="runs">Platform runs</TabsTrigger>
          <TabsTrigger value="exceptions">Exception queue</TabsTrigger>
          <TabsTrigger value="school">School summary</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileUp className="h-4 w-4" /> Upload settlement CSV
                </CardTitle>
                <CardDescription>
                  TIPS and CBS use distinct column specs. Upload one source per file.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-wrap gap-3" onSubmit={uploadFile}>
                  <Input
                    className="max-w-md"
                    accept=".csv,text/csv"
                    type="file"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <Button type="submit" disabled={!file}>
                    Upload CSV
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4" /> Simulator feed
                </CardTitle>
                <CardDescription>
                  Generate paired TIPS + CBS legs (or a single source) for the date window.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="date"
                    aria-label="Simulation from date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                  <Input
                    type="date"
                    aria-label="Simulation to date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                  />
                  <Select value={source} onChange={(event) => setSource(event.target.value)}>
                    <option value="">Both (three-way)</option>
                    <option value="TIPS">TIPS only</option>
                    <option value="CBS">CBS only</option>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void runAction(
                        () =>
                          generateSimFeed(accessToken!, {
                            dateFrom: dateFrom || undefined,
                            dateTo: dateTo || undefined,
                            source: validSource,
                            threeWay: !validSource,
                          }),
                        'Simulator feed generated.',
                      )
                    }
                  >
                    <Sparkles className="mr-2 h-4 w-4" /> Generate feed
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-4 w-4" /> Start reconciliation run
              </CardTitle>
              <CardDescription>
                Leave source empty (or enable three-way) for MMS↔TIPS↔CBS. Soft ±1d / hard ±3d date bands apply.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!dateFrom || !dateTo) {
                    setError('Enter both dates before starting a reconciliation run.');
                    return;
                  }
                  void runAction(
                    () =>
                      startReconciliationRun(accessToken!, {
                        dateFrom,
                        dateTo,
                        source: validSource,
                        threeWay: threeWay || !validSource,
                      }),
                    'Reconciliation run started.',
                  );
                }}
              >
                <Input
                  className="w-48"
                  required
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
                <Input
                  className="w-48"
                  required
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
                <Select className="w-40" value={source} onChange={(event) => setSource(event.target.value)}>
                  <option value="">All sources</option>
                  <option value="TIPS">TIPS</option>
                  <option value="CBS">CBS</option>
                </Select>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={threeWay}
                    onChange={(event) => setThreeWay(event.target.checked)}
                  />
                  Three-way
                </label>
                <Button type="submit">
                  <Play className="mr-2 h-4 w-4" /> Start run
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reconciliation runs</CardTitle>
              <CardDescription>Select a run to inspect matches, groups, and exceptions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((item, index) => {
                    const record = asRecord(item);
                    const id = text(record.id);
                    return (
                      <TableRow
                        className="cursor-pointer"
                        key={id === '—' ? index : id}
                        onClick={() => setSelectedRunId(id)}
                      >
                        <TableCell className="font-mono text-xs">{id}</TableCell>
                        <TableCell>{text(record.mode)}</TableCell>
                        <TableCell>
                          {text(record.dateFrom)} — {text(record.dateTo)}
                        </TableCell>
                        <TableCell>{text(record.source)}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(text(record.status))}>
                            {text(record.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!runsQuery.isLoading && !runs.length && (
                <p className="p-5 text-sm text-muted-foreground">No reconciliation runs have been started.</p>
              )}
            </CardContent>
          </Card>

          {selectedRunId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Run detail</CardTitle>
                <CardDescription>{selectedRunId}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {runDetailQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading run detail…</p>
                ) : (
                  <>
                    <Summary title="Summary" value={selectedRun.summary ?? selectedRun.counts} />
                    <GroupLists value={selectedRun.matchGroups} />
                    <MatchLists value={selectedRun.matches ?? selectedRun.matchLists ?? selectedRun} />
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="exceptions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" /> Exception queue
              </CardTitle>
              <CardDescription>
                Financial actions route through maker-checker (self-approve blocked).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Opened</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptions.map((item, index) => {
                    const record = asRecord(item);
                    const id = text(record.id);
                    return (
                      <TableRow
                        className="cursor-pointer"
                        key={id === '—' ? index : id}
                        onClick={() => setSelectedCaseId(id)}
                      >
                        <TableCell className="font-mono text-xs">{text(record.caseNumber)}</TableCell>
                        <TableCell>{text(record.classification)}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(text(record.severity))}>
                            {text(record.severity)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(text(record.status))}>
                            {text(record.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{text(record.createdAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!exceptionsQuery.isLoading && !exceptions.length && (
                <p className="p-5 text-sm text-muted-foreground">No open exceptions.</p>
              )}
            </CardContent>
          </Card>

          {selectedCaseId && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Case detail</CardTitle>
                  <CardDescription>{text(selectedCase.caseNumber)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {exceptionDetailQuery.isLoading ? (
                    <p className="text-muted-foreground">Loading case…</p>
                  ) : (
                    <>
                      <p>
                        <span className="text-muted-foreground">Title: </span>
                        {text(selectedCase.title)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Status: </span>
                        {text(selectedCase.status)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Classification: </span>
                        {text(selectedCase.classification)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Summary: </span>
                        {text(selectedCase.summary)}
                      </p>
                      <pre className="overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
                        {JSON.stringify(selectedCase.context ?? selectedCase.matchGroup ?? {}, null, 2)}
                      </pre>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Propose resolution</CardTitle>
                  <CardDescription>Maker submits; checker approves via Approvals.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select
                    value={action}
                    onChange={(event) => setAction(event.target.value as (typeof RESOLVE_ACTIONS)[number])}
                  >
                    {RESOLVE_ACTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                  <Input
                    placeholder="Fee payment ID (manual match / reverse)"
                    value={feePaymentId}
                    onChange={(event) => setFeePaymentId(event.target.value)}
                  />
                  <Input
                    placeholder="External settlement ID (manual match / bank error)"
                    value={externalId}
                    onChange={(event) => setExternalId(event.target.value)}
                  />
                  <Input
                    placeholder="Notes"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <Button
                    onClick={() =>
                      void runAction(
                        () =>
                          resolveReconException(accessToken!, selectedCaseId, {
                            action,
                            note: note || undefined,
                            payload: {
                              feePaymentId: feePaymentId || undefined,
                              externalSettlementRecordId: externalId || undefined,
                              reason: note || undefined,
                            },
                          }),
                        'Resolution submitted.',
                      )
                    }
                  >
                    Submit action
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="school" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">School reconciliation summary</CardTitle>
              <CardDescription>
                Includes three-way group counts and open exceptions (sanitized school view available via school APIs).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <Select value={merchantId} onChange={(event) => setMerchantId(event.target.value)}>
                <option value="">Select school…</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.tradingName}
                  </option>
                ))}
              </Select>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              <Button
                variant="outline"
                onClick={() => void schoolSummaryQuery.refetch()}
                disabled={!merchantId || !dateFrom || !dateTo}
              >
                Refresh summary
              </Button>
            </CardContent>
          </Card>
          {merchantId && dateFrom && dateTo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Summary title="" value={schoolSummary} />
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Summary title="Classifications" value={asRecord(schoolSummary.classifications)} />
                  <Summary title="Match groups" value={asRecord(schoolSummary.matchGroups)} />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Summary({ title, value }: { title: string; value: unknown }) {
  const record = asRecord(value);
  const flat = Object.entries(record).filter(([, entry]) => typeof entry !== 'object');
  return (
    <div>
      {title && <p className="mb-3 text-sm font-medium">{title}</p>}
      {flat.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {flat.map(([label, entry]) => (
            <div key={label}>
              <p className="text-xs capitalize text-muted-foreground">
                {label.replace(/([A-Z])/g, ' $1')}
              </p>
              <p className="text-lg font-semibold">{text(entry)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No summary is available.</p>
      )}
    </div>
  );
}

function MatchLists({ value }: { value: unknown }) {
  const list = Array.isArray(value) ? value : [];
  if (!list.length) {
    const record = asRecord(value);
    const lists = Object.entries(record).filter(([, entry]) => Array.isArray(entry));
    if (!lists.length) {
      return <p className="text-sm text-muted-foreground">No matches for this run.</p>;
    }
    return (
      <div className="space-y-4">
        {lists.map(([label, entries]) => (
          <div key={label}>
            <p className="mb-2 text-sm font-medium capitalize">{label.replace(/([A-Z])/g, ' $1')}</p>
            <div className="space-y-2">
              {asList(entries)
                .slice(0, 20)
                .map((entry, index) => (
                  <div className="rounded-md border border-border p-3 text-sm" key={index}>
                    {Object.entries(asRecord(entry)).map(([key, item]) => (
                      <p key={key}>
                        <span className="text-muted-foreground">{key}: </span>
                        {typeof item === 'object' ? JSON.stringify(item) : text(item)}
                      </p>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="mb-2 text-sm font-medium">Matches ({list.length})</p>
      {list.slice(0, 30).map((entry, index) => {
        const record = asRecord(entry);
        return (
          <div className="rounded-md border border-border p-3 text-sm" key={index}>
            <p>
              <span className="text-muted-foreground">classification: </span>
              {text(record.classification)}
            </p>
            <p>
              <span className="text-muted-foreground">rule: </span>
              {text(record.rule)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function GroupLists({ value }: { value: unknown }) {
  const list = asList(value);
  if (!list.length) return null;
  return (
    <div className="space-y-2">
      <p className="mb-2 text-sm font-medium">Match groups ({list.length})</p>
      {list.slice(0, 30).map((entry, index) => {
        const record = asRecord(entry);
        const legs = asList(record.legs);
        return (
          <div className="rounded-md border border-border p-3 text-sm" key={index}>
            <p>
              <span className="text-muted-foreground">status: </span>
              {text(record.status)}
            </p>
            <p>
              <span className="text-muted-foreground">legs: </span>
              {legs.map((leg) => text(asRecord(leg).legType)).join(' + ') || '—'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
