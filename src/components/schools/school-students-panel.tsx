'use client';

import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Mail, MessageSquare, Search, Upload, UserPlus } from 'lucide-react';
import QRCode from 'qrcode';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/providers/auth-provider';
import { StudentQrPoster, type PosterRecord } from './student-qr-poster';
import { CsvImportModal } from './csv-import-modal';
import {
  createStudent,
  fetchStudentQrPayload,
  listStudents,
  sendQrToParent,
  type BatchConfirmResult,
  type Student,
} from '@/lib/students-api';
import { formatLipaNamba } from '@/lib/format-lipa-namba';
import { writePosterToWindow } from '@/lib/poster-utils';

// ─── Types ──────────────────────────────────────────────────────────────────

type StatusLabel = 'Active' | 'Suspended' | 'Inactive';

function getStatus(s: Student): StatusLabel {
  switch (s.status) {
    case 'ACTIVE': return 'Active';
    case 'SUSPENDED': return 'Suspended';
    case 'INACTIVE': return 'Inactive';
    default:
      // Fallback for legacy records without status field
      if (!s.isActive || !s.studentAlias) return 'Inactive';
      return s.studentAlias.isActive ? 'Active' : 'Suspended';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

interface SchoolStudentsPanelProps {
  merchantId: string;
}

export function SchoolStudentsPanel({ merchantId }: SchoolStudentsPanelProps) {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  // Enrol form
  const [admissionNo, setAdmissionNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Table
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | StatusLabel>('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [posterRecord, setPosterRecord] = useState<PosterRecord | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Per-row send-qr state: studentId → 'email' | 'sms' → boolean
  const [sendingQr, setSendingQr] = useState<Record<string, Set<string>>>({});

  // Per-session payload cache: qrCodeId → tlvPayload
  const payloadCache = useRef(new Map<string, string>());

  const canWrite = user?.permissions?.includes('school:student:write');
  const canBulk = user?.permissions?.includes('school:student:bulk');
  const canRead = user?.permissions?.includes('school:student:read');

  const studentsQuery = useQuery({
    queryKey: ['students', merchantId],
    queryFn: () => listStudents(accessToken!, merchantId),
    enabled: !!accessToken && Boolean(canRead),
  });

  // ── Filters ──────────────────────────────────────────────────────────────

  const filtered = (studentsQuery.data ?? []).filter((s) => {
    if (statusFilter !== 'All' && getStatus(s) !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredIds = filtered.map((s) => s.id);
  const allSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someSelected =
    filteredIds.some((id) => selectedIds.has(id)) && !allSelected;

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Payload fetch with cache ──────────────────────────────────────────────

  const getPayload = useCallback(
    async (qrId: string): Promise<string | null> => {
      const hit = payloadCache.current.get(qrId);
      if (hit) return hit;
      if (!accessToken) return null;
      const result = await fetchStudentQrPayload(accessToken, qrId);
      if (result) {
        payloadCache.current.set(qrId, result.tlvPayload);
        return result.tlvPayload;
      }
      return null;
    },
    [accessToken],
  );

  // ── Single QR modal ───────────────────────────────────────────────────────

  async function handleViewQr(s: Student) {
    const qrId = s.studentAlias?.qrCodeId;
    if (!qrId) return;
    setPosterRecord({
      id: s.id,
      name: s.fullName,
      alias: s.studentAlias!.alias10digit,
      tlvPayload: null,
      statusLabel: getStatus(s),
    });
    const payload = await getPayload(qrId);
    setPosterRecord((prev) =>
      prev?.id === s.id ? { ...prev, tlvPayload: payload } : prev,
    );
  }

  // ── Send QR to parent ─────────────────────────────────────────────────────

  async function handleSendQr(s: Student, channel: 'email' | 'sms') {
    if (!accessToken) return;
    setSendingQr((prev) => {
      const next = { ...prev };
      next[s.id] = new Set(prev[s.id] ?? []);
      next[s.id].add(channel);
      return next;
    });
    try {
      await sendQrToParent(accessToken, merchantId, s.id, [channel]);
    } catch {
      // silent — could show a toast in a richer setup
    } finally {
      setSendingQr((prev) => {
        const next = { ...prev };
        const ch = new Set(prev[s.id] ?? []);
        ch.delete(channel);
        next[s.id] = ch;
        return next;
      });
    }
  }

  // ── Bulk PDF ──────────────────────────────────────────────────────────────

  async function handleBulkPdf() {
    if (!accessToken) return;

    // Open window SYNCHRONOUSLY on click to avoid popup blockers
    const win = window.open('', '_blank', 'width=630,height=840');
    if (!win) {
      alert('Please allow pop-ups to save the PDF.');
      return;
    }
    win.document.write(
      '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial;color:#666"><p>Preparing QR posters…</p></body></html>',
    );

    setBulkLoading(true);
    try {
      const selectedStudents = (studentsQuery.data ?? []).filter((s) =>
        selectedIds.has(s.id),
      );
      const records = (
        await Promise.all(
          selectedStudents.map(async (s) => {
            const qrId = s.studentAlias?.qrCodeId;
            if (!qrId) return null;
            const payload = await getPayload(qrId);
            if (!payload) return null;
            const qrDataUrl = await QRCode.toDataURL(payload, {
              width: 200,
              margin: 1,
              errorCorrectionLevel: 'M',
              color: { dark: '#000000', light: '#ffffff' },
            });
            return {
              name: s.fullName,
              alias: s.studentAlias!.alias10digit,
              qrDataUrl,
              statusLabel: getStatus(s) as string,
            };
          }),
        )
      ).filter((r): r is NonNullable<typeof r> => r !== null);

      if (records.length === 0) {
        win.close();
        alert('No QR codes available for the selected students.');
        return;
      }
      await writePosterToWindow(win, records);
    } catch {
      win.close();
    } finally {
      setBulkLoading(false);
    }
  }

  // ── Enrol form ────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setFormLoading(true);
    setFormErr(null);
    setFormMsg(null);
    try {
      const result = await createStudent(accessToken, merchantId, {
        admissionNo,
        fullName,
        guardianPhone: guardianPhone || undefined,
        parentEmail: parentEmail || undefined,
      });
      setFormMsg(
        `Student enrolled — Lipa Namba: ${formatLipaNamba(result.alias.alias10digit)}`,
      );
      setAdmissionNo('');
      setFullName('');
      setGuardianPhone('');
      setParentEmail('');
      await queryClient.invalidateQueries({ queryKey: ['students', merchantId] });
    } catch (err) {
      setFormErr(
        err instanceof Error ? err.message : 'Failed to enrol student',
      );
    } finally {
      setFormLoading(false);
    }
  }

  function handleCsvSuccess(result: BatchConfirmResult) {
    void queryClient.invalidateQueries({ queryKey: ['students', merchantId] });
    setFormMsg(
      `CSV import queued — ${result.queued} student${result.queued !== 1 ? 's' : ''} being processed.`,
    );
  }

  // ── Guard ────────────────────────────────────────────────────────────────

  if (!canRead) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to view students.
      </p>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Enrol form */}
      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Enrol Student
            </CardTitle>
            <CardDescription>
              Issues a permanent 10-digit Lipa Namba alias and static TANQR QR code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="admissionNo">Admission No</Label>
                <Input
                  id="admissionNo"
                  value={admissionNo}
                  onChange={(e) => setAdmissionNo(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardianPhone">Guardian Phone</Label>
                <Input
                  id="guardianPhone"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="255712345678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentEmail">Parent Email</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={formLoading}>
                  Enrol &amp; Generate Alias
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Bulk CSV import */}
      {canBulk && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" />
              Bulk Student Import
            </CardTitle>
            <CardDescription>
              CSV columns: Admission, FirstName, Surname, ParentEmail (optional), MobileNumber (optional).
              Preview and validate before committing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCsvModal(true)}
            >
              Import CSV
            </Button>
          </CardContent>
        </Card>
      )}

      {formMsg && (
        <p className="text-sm text-[var(--brand-black)]">{formMsg}</p>
      )}
      {formErr && <p className="text-sm text-destructive">{formErr}</p>}

      {/* Registry table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student Registry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name or admission no…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
              style={{ width: '140px' }}
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/60 px-4 py-2">
              <span className="text-sm font-medium">
                {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto gap-1.5"
                disabled={bulkLoading}
                onClick={() => void handleBulkPdf()}
              >
                <FileDown className="h-3.5 w-3.5" />
                {bulkLoading ? 'Preparing…' : 'Download as PDF'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Table */}
          {studentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading students…</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                          }}
                          onChange={toggleAll}
                          className="h-4 w-4 cursor-pointer rounded border-input"
                          aria-label="Select all visible"
                        />
                      </TableHead>
                      <TableHead>Admission</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lipa Namba</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground"
                        >
                          No students match the current filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((s) => {
                        const status = getStatus(s);
                        const alias = s.studentAlias?.alias10digit;
                        const isSendingEmail = sendingQr[s.id]?.has('email') ?? false;
                        const isSendingSms = sendingQr[s.id]?.has('sms') ?? false;
                        return (
                          <TableRow
                            key={s.id}
                            data-state={
                              selectedIds.has(s.id) ? 'selected' : undefined
                            }
                          >
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(s.id)}
                                onChange={() => toggleRow(s.id)}
                                className="h-4 w-4 cursor-pointer rounded border-input"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {s.admissionNo}
                            </TableCell>
                            <TableCell>{s.fullName}</TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(status.toUpperCase())}>
                                {status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono tracking-widest">
                              {alias ? formatLipaNamba(alias) : '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                {/* View QR */}
                                {s.studentAlias?.qrCodeId ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => void handleViewQr(s)}
                                  >
                                    QR
                                  </Button>
                                ) : (
                                  <span className="w-9" />
                                )}

                                {/* Send email to parent */}
                                {canWrite && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    title={
                                      s.parentEmail
                                        ? `Send QR to ${s.parentEmail}`
                                        : 'No parent email on file'
                                    }
                                    disabled={!s.parentEmail || !s.studentAlias || isSendingEmail}
                                    onClick={() => void handleSendQr(s, 'email')}
                                  >
                                    <Mail className={`h-3.5 w-3.5 ${isSendingEmail ? 'animate-pulse' : ''}`} />
                                  </Button>
                                )}

                                {/* Send SMS to guardian */}
                                {canWrite && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    title={
                                      s.guardianPhone
                                        ? `Send QR SMS to ${s.guardianPhone}`
                                        : 'No guardian phone on file'
                                    }
                                    disabled={!s.guardianPhone || !s.studentAlias || isSendingSms}
                                    onClick={() => void handleSendQr(s, 'sms')}
                                  >
                                    <MessageSquare className={`h-3.5 w-3.5 ${isSendingSms ? 'animate-pulse' : ''}`} />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {filtered.length < (studentsQuery.data?.length ?? 0) && (
                <p className="text-xs text-muted-foreground">
                  Showing {filtered.length} of {studentsQuery.data?.length} students
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Single-record QR poster modal */}
      {posterRecord && (
        <StudentQrPoster
          record={posterRecord}
          onClose={() => setPosterRecord(null)}
        />
      )}

      {/* CSV import modal */}
      {showCsvModal && accessToken && (
        <CsvImportModal
          merchantId={merchantId}
          token={accessToken}
          onSuccess={handleCsvSuccess}
          onClose={() => setShowCsvModal(false)}
        />
      )}
    </div>
  );
}
