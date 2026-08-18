'use client';

import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Upload, X } from 'lucide-react';
import {
  bulkConfirmStudents,
  bulkPreviewStudents,
  type BatchConfirmResult,
  type BulkPreviewResult,
  type PreviewRow,
} from '@/lib/students-api';

interface CsvImportModalProps {
  merchantId: string;
  token: string;
  onSuccess: (result: BatchConfirmResult) => void;
  onClose: () => void;
}

type Step = 'upload' | 'preview' | 'confirming' | 'done';

export function CsvImportModal({
  merchantId,
  token,
  onSuccess,
  onClose,
}: CsvImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkPreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<BatchConfirmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [consentAttested, setConsentAttested] = useState(false);

  // Only submit valid non-duplicate rows on confirm
  const validRows: PreviewRow[] = preview
    ? preview.rows.filter((r) => r.valid && !r.isDuplicate)
    : [];

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await bulkPreviewStudents(token, merchantId, file);
      setPreview(result);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview || validRows.length === 0 || !consentAttested) return;
    setStep('confirming');
    setError(null);
    try {
      const result = await bulkConfirmStudents(token, merchantId, validRows, consentAttested);
      setConfirmResult(result);
      setStep('done');
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  }

  function downloadTemplate() {
    const csv = 'Admission,FirstName,Surname,ParentEmail,MobileNumber\nS001,John,Doe,parent@example.com,255700000001\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setConfirmResult(null);
    setError(null);
    setConsentAttested(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl rounded-[14px] border border-border-default bg-surface shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-hairline px-6 py-4">
          <h2 className="text-[15px] font-semibold text-text-primary">Import Students from CSV</h2>
          <button
            onClick={onClose}
            className="rounded-[8px] p-1 text-text-muted transition-colors hover:bg-subtle hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Step: Upload */}
          {step === 'upload' && (
            <>
              <p className="text-[13px] text-text-secondary">
                Upload a CSV file with columns:{' '}
                <span className="font-mono text-[12px] text-text-muted">
                  Admission, FirstName, Surname, ParentEmail (optional), MobileNumber (required)
                </span>
                . MobileNumber is the guardian&apos;s number and is where each student&apos;s Lipa
                Namba notification is sent — rows without it will be rejected.
              </p>
              <div
                className="dropzone flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed border-border-input py-10"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-7 w-7 text-text-muted" />
                {file ? (
                  <span className="text-[13.5px] font-medium text-text-primary">{file.name}</span>
                ) : (
                  <span className="text-[13.5px] text-text-muted">
                    Click to select a CSV file
                  </span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {error && (
                <p className="flex items-center gap-1.5 text-[13px] text-danger-text">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
              <div className="flex justify-between gap-2">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 text-[12.5px] text-text-muted transition-colors hover:text-text-body"
                >
                  <Download className="h-3 w-3" />
                  Download template
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-[9px] px-4 py-[9px] text-[13px] text-text-body transition-colors hover:bg-subtle"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handlePreview()}
                    disabled={!file || loading}
                    className="rounded-[9px] bg-button-primary px-4 py-[9px] text-[13px] font-medium text-white transition-colors hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? 'Parsing…' : 'Preview'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step: Preview */}
          {step === 'preview' && preview && (
            <>
              {/* Summary pills */}
              <div className="flex flex-wrap gap-2 text-[12.5px]">
                <span className="rounded-[20px] bg-muted px-3 py-1 font-medium text-text-body">
                  {preview.total} rows total
                </span>
                <span className="rounded-[20px] bg-success-bg px-3 py-1 font-medium text-success-text">
                  {preview.valid} valid
                </span>
                {preview.invalid > 0 && (
                  <span className="rounded-[20px] bg-danger-bg px-3 py-1 font-medium text-danger-text">
                    {preview.invalid} invalid
                  </span>
                )}
              </div>

              {/* Preview table */}
              <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-[12px] border border-border-default">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border-hairline text-[12px] font-medium text-text-muted">
                      <th className="w-12 px-3 py-2.5 text-left font-medium">#</th>
                      <th className="px-2 py-2.5 text-left font-medium">Admission</th>
                      <th className="px-2 py-2.5 text-left font-medium">Name</th>
                      <th className="px-2 py-2.5 text-left font-medium">Phone</th>
                      <th className="px-2 py-2.5 text-left font-medium">Email</th>
                      <th className="px-3 py-2.5 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr
                        key={r.row}
                        className={`${i < preview.rows.length - 1 ? 'border-b border-border-row' : ''} ${
                          !r.valid || r.isDuplicate ? 'bg-danger-bg/40' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-[12px] text-text-muted">{r.row}</td>
                        <td className="px-2 py-2 font-mono text-[12px] text-text-body">
                          {r.admissionNo}
                        </td>
                        <td className="px-2 py-2 text-text-body">{r.fullName}</td>
                        <td className="px-2 py-2 text-[12px] text-text-muted">
                          {r.guardianPhone ?? '—'}
                        </td>
                        <td className="px-2 py-2 text-[12px] text-text-muted">
                          {r.parentEmail ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          {r.isDuplicate ? (
                            <span className="rounded-[20px] bg-danger-bg px-2 py-0.5 text-[10.5px] font-medium text-danger-text">
                              Duplicate
                            </span>
                          ) : r.valid ? (
                            <span className="rounded-[20px] bg-success-bg px-2 py-0.5 text-[10.5px] font-medium text-success-text">
                              OK
                            </span>
                          ) : (
                            <span
                              className="text-[10.5px] text-danger-text"
                              title={r.errors.join('; ')}
                            >
                              {r.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Parental/guardian consent attestation — brief §4.3.2. This is a
                  school-level attestation, not per-student consent capture: MMS
                  isn't expected to verify each parent's consent individually,
                  only that the school has affirmatively confirmed the lawful
                  basis exists. */}
              <label className="flex items-start gap-2.5 rounded-[12px] border border-border-default bg-subtle p-3 text-[13px]">
                <input
                  type="checkbox"
                  checked={consentAttested}
                  onChange={(e) => setConsentAttested(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                />
                <span className="text-text-body">
                  The school confirms parental/guardian consent, or an equivalent lawful basis
                  under the Personal Data Protection Act 2022, has been obtained for the students
                  in this roster.
                </span>
              </label>

              {error && (
                <p className="flex items-center gap-1.5 text-[13px] text-danger-text">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <div className="flex justify-between gap-2">
                <button
                  onClick={reset}
                  className="rounded-[9px] px-4 py-[9px] text-[13px] text-text-body transition-colors hover:bg-subtle"
                >
                  Back
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-[9px] px-4 py-[9px] text-[13px] text-text-body transition-colors hover:bg-subtle"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleConfirm()}
                    disabled={validRows.length === 0 || !consentAttested}
                    title={!consentAttested ? 'Confirm the consent attestation above first' : undefined}
                    className="rounded-[9px] bg-button-primary px-4 py-[9px] text-[13px] font-medium text-white transition-colors hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Import {validRows.length} student{validRows.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step: Confirming */}
          {step === 'confirming' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-track border-t-button-primary" />
              <p className="text-[13px] text-text-muted">
                Importing students and queuing alias generation…
              </p>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && confirmResult && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-strong text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-text-primary">Import queued successfully</p>
                <p className="mt-1 text-[13px] text-text-muted">
                  {confirmResult.queued} student{confirmResult.queued !== 1 ? 's' : ''} queued for
                  alias generation.{' '}
                  {confirmResult.skipped > 0 &&
                    `${confirmResult.skipped} skipped (already active).`}
                </p>
                <p className="mt-1 text-[12px] text-text-muted">
                  Batch ID: <span className="font-mono">{confirmResult.batchId}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-[9px] bg-button-primary px-5 py-[9px] text-[13px] font-medium text-white transition-colors hover:bg-button-primary-hover"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
