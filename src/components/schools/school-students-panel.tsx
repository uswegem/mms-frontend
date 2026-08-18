'use client';

import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Mail, MessageSquare, Search, Upload, UserPlus } from 'lucide-react';
import QRCode from 'qrcode';
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

function statusPillColor(status: StatusLabel): string {
  switch (status) {
    case 'Active':
      return 'bg-success-bg text-success-text';
    case 'Suspended':
      return 'bg-warning-bg text-warning-text';
    default:
      return 'bg-track text-text-muted';
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
        guardianPhone,
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
      <p className="text-[13px] text-text-muted">
        You do not have permission to view students.
      </p>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* Enrol form */}
      {canWrite && (
        <div className="rounded-[14px] border border-border-default bg-surface p-[22px]">
          <div className="mb-1 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-text-muted" />
            <h3 className="text-[15px] font-semibold text-text-primary">Enrol Student</h3>
          </div>
          <p className="mb-4 text-[13px] text-text-muted">
            Issues a permanent 10-digit Lipa Namba alias and static TANQR QR code.
          </p>
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <label className="mb-1.5 block text-[12.5px] text-text-body" htmlFor="admissionNo">
                Admission No
              </label>
              <input
                id="admissionNo"
                value={admissionNo}
                onChange={(e) => setAdmissionNo(e.target.value)}
                required
                className="w-full rounded-[9px] border border-border-input px-3 py-2.5 text-[13.5px] text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] text-text-body" htmlFor="fullName">
                Full Name
              </label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-[9px] border border-border-input px-3 py-2.5 text-[13.5px] text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] text-text-body" htmlFor="guardianPhone">
                Guardian Phone
              </label>
              <input
                id="guardianPhone"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder="255712345678"
                required
                className="w-full rounded-[9px] border border-border-input px-3 py-2.5 text-[13.5px] text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] text-text-body" htmlFor="parentEmail">
                Parent Email
              </label>
              <input
                id="parentEmail"
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="parent@example.com"
                className="w-full rounded-[9px] border border-border-input px-3 py-2.5 text-[13.5px] text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <button
                type="submit"
                disabled={formLoading}
                className="rounded-[10px] bg-button-primary px-5 py-[11px] text-[13.5px] font-medium text-white transition-colors hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Enrol &amp; Generate Alias
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk CSV import */}
      {canBulk && (
        <div className="rounded-[14px] border border-border-default bg-surface p-[22px]">
          <div className="mb-1 flex items-center gap-2">
            <Upload className="h-4 w-4 text-text-muted" />
            <h3 className="text-[15px] font-semibold text-text-primary">Bulk Student Import</h3>
          </div>
          <p className="mb-4 text-[13px] text-text-muted">
            CSV columns: Admission, FirstName, Surname, ParentEmail (optional), MobileNumber
            (required). Preview and validate before committing.
          </p>
          <button
            onClick={() => setShowCsvModal(true)}
            className="rounded-[9px] border border-border-input px-4 py-[9px] text-[13px] text-text-body transition-colors hover:border-[#c9c9c3]"
          >
            Import CSV
          </button>
        </div>
      )}

      {formMsg && <p className="text-[13px] text-success-text">{formMsg}</p>}
      {formErr && <p className="text-[13px] text-danger-text">{formErr}</p>}

      {/* Registry table */}
      <div className="rounded-[14px] border border-border-default bg-surface">
        <div className="px-5 py-4">
          <h3 className="text-[15px] font-semibold text-text-primary">Student Registry</h3>
        </div>
        <div className="flex flex-wrap gap-3 px-5 pb-4">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              placeholder="Search name or admission no…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[9px] border border-border-input py-2.5 pl-9 pr-3 text-[13.5px] text-text-primary outline-none focus:border-accent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-[9px] border border-border-input px-3 py-2.5 text-[13.5px] text-text-body outline-none focus:border-accent"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mx-5 mb-4 flex flex-wrap items-center gap-3 rounded-[10px] border border-border-default bg-subtle px-4 py-2.5">
            <span className="text-[13px] font-medium text-text-primary">
              {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              disabled={bulkLoading}
              onClick={() => void handleBulkPdf()}
              className="ml-auto flex items-center gap-1.5 rounded-[8px] border border-border-input px-3 py-[6px] text-[12.5px] text-text-body transition-colors hover:border-[#c9c9c3] disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              {bulkLoading ? 'Preparing…' : 'Download as PDF'}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[12.5px] text-text-muted hover:text-text-body"
            >
              Clear
            </button>
          </div>
        )}

        {/* Table */}
        {studentsQuery.isLoading ? (
          <p className="px-5 pb-5 text-[13px] text-text-muted">Loading students…</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-y border-border-hairline text-[12px] font-medium text-text-muted">
                    <th className="w-10 px-5 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={toggleAll}
                        className="h-4 w-4 cursor-pointer accent-accent"
                        aria-label="Select all visible"
                      />
                    </th>
                    <th className="px-2 py-3 text-left font-medium">Admission</th>
                    <th className="px-2 py-3 text-left font-medium">Name</th>
                    <th className="px-2 py-3 text-left font-medium">Status</th>
                    <th className="px-2 py-3 text-left font-medium">Lipa Namba</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                        No students match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s, i) => {
                      const status = getStatus(s);
                      const alias = s.studentAlias?.alias10digit;
                      const isSendingEmail = sendingQr[s.id]?.has('email') ?? false;
                      const isSendingSms = sendingQr[s.id]?.has('sms') ?? false;
                      return (
                        <tr
                          key={s.id}
                          className={
                            i < filtered.length - 1 ? 'border-b border-border-row' : ''
                          }
                        >
                          <td className="px-5 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(s.id)}
                              onChange={() => toggleRow(s.id)}
                              className="h-4 w-4 cursor-pointer accent-accent"
                            />
                          </td>
                          <td className="px-2 py-3 font-mono text-[12px] text-text-muted">
                            {s.admissionNo}
                          </td>
                          <td className="px-2 py-3 text-text-body">{s.fullName}</td>
                          <td className="px-2 py-3">
                            <span
                              className={`rounded-[20px] px-2.5 py-1 text-[11.5px] font-medium ${statusPillColor(status)}`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="px-2 py-3 font-mono tracking-widest text-text-body">
                            {alias ? formatLipaNamba(alias) : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {/* View QR */}
                              {s.studentAlias?.qrCodeId ? (
                                <button
                                  onClick={() => void handleViewQr(s)}
                                  className="rounded-[8px] border border-border-input px-2 py-1 text-[12px] text-text-body transition-colors hover:border-[#c9c9c3]"
                                >
                                  QR
                                </button>
                              ) : (
                                <span className="w-9" />
                              )}

                              {/* Send email to parent */}
                              {canWrite && (
                                <button
                                  title={
                                    s.parentEmail
                                      ? `Send QR to ${s.parentEmail}`
                                      : 'No parent email on file'
                                  }
                                  disabled={!s.parentEmail || !s.studentAlias || isSendingEmail}
                                  onClick={() => void handleSendQr(s, 'email')}
                                  className="flex h-7 w-7 items-center justify-center rounded-[8px] text-text-muted transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Mail className={`h-3.5 w-3.5 ${isSendingEmail ? 'animate-pulse' : ''}`} />
                                </button>
                              )}

                              {/* Send SMS to guardian */}
                              {canWrite && (
                                <button
                                  title={
                                    s.guardianPhone
                                      ? `Send QR SMS to ${s.guardianPhone}`
                                      : 'No guardian phone on file'
                                  }
                                  disabled={!s.guardianPhone || !s.studentAlias || isSendingSms}
                                  onClick={() => void handleSendQr(s, 'sms')}
                                  className="flex h-7 w-7 items-center justify-center rounded-[8px] text-text-muted transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <MessageSquare className={`h-3.5 w-3.5 ${isSendingSms ? 'animate-pulse' : ''}`} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length < (studentsQuery.data?.length ?? 0) && (
              <p className="px-5 py-3 text-[12px] text-text-muted">
                Showing {filtered.length} of {studentsQuery.data?.length} students
              </p>
            )}
          </>
        )}
      </div>

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
