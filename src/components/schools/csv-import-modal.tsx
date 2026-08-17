'use client';

import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
      <div className="relative w-full max-w-3xl rounded-xl border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Import Students from CSV</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Step: Upload */}
          {step === 'upload' && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with columns:{' '}
                <span className="font-mono text-xs">
                  Admission, FirstName, Surname, ParentEmail (optional), MobileNumber (required)
                </span>
                . MobileNumber is the guardian&apos;s number and is where each student&apos;s Lipa
                Namba notification is sent — rows without it will be rejected.
              </p>
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-10 cursor-pointer hover:border-primary/60 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                {file ? (
                  <span className="text-sm font-medium">{file.name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">
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
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
              <div className="flex justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground"
                  onClick={downloadTemplate}
                >
                  <Download className="h-3 w-3" />
                  Download template
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handlePreview()} disabled={!file || loading}>
                    {loading ? 'Parsing…' : 'Preview'}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Step: Preview */}
          {step === 'preview' && preview && (
            <>
              {/* Summary pills */}
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-muted px-3 py-0.5 font-medium">
                  {preview.total} rows total
                </span>
                <span className="rounded-full bg-green-100 px-3 py-0.5 font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                  {preview.valid} valid
                </span>
                {preview.invalid > 0 && (
                  <span className="rounded-full bg-red-100 px-3 py-0.5 font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                    {preview.invalid} invalid
                  </span>
                )}
              </div>

              {/* Preview table */}
              <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Admission</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((r) => (
                      <TableRow
                        key={r.row}
                        className={
                          !r.valid || r.isDuplicate ? 'bg-red-50 dark:bg-red-950/20' : undefined
                        }
                      >
                        <TableCell className="text-muted-foreground text-xs">
                          {r.row}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.admissionNo}
                        </TableCell>
                        <TableCell className="text-sm">{r.fullName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.guardianPhone ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.parentEmail ?? '—'}
                        </TableCell>
                        <TableCell>
                          {r.isDuplicate ? (
                            <Badge variant="danger" className="text-[10px]">
                              Duplicate
                            </Badge>
                          ) : r.valid ? (
                            <Badge variant="success" className="text-[10px]">
                              OK
                            </Badge>
                          ) : (
                            <span
                              className="text-[10px] text-destructive"
                              title={r.errors.join('; ')}
                            >
                              {r.errors[0]}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Parental/guardian consent attestation — brief §4.3.2. This is a
                  school-level attestation, not per-student consent capture: MMS
                  isn't expected to verify each parent's consent individually,
                  only that the school has affirmatively confirmed the lawful
                  basis exists. */}
              <label className="flex items-start gap-2.5 rounded-md border border-border bg-muted/30 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={consentAttested}
                  onChange={(e) => setConsentAttested(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>
                  The school confirms parental/guardian consent, or an equivalent lawful basis
                  under the Personal Data Protection Act 2022, has been obtained for the students
                  in this roster.
                </span>
              </label>

              {error && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <div className="flex justify-between gap-2">
                <Button variant="ghost" onClick={reset}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void handleConfirm()}
                    disabled={validRows.length === 0 || !consentAttested}
                    title={!consentAttested ? 'Confirm the consent attestation above first' : undefined}
                  >
                    Import {validRows.length} student{validRows.length !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Step: Confirming */}
          {step === 'confirming' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <p className="text-sm text-muted-foreground">
                Importing students and queuing alias generation…
              </p>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && confirmResult && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <div>
                <p className="font-semibold">Import queued successfully</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {confirmResult.queued} student{confirmResult.queued !== 1 ? 's' : ''} queued for
                  alias generation.{' '}
                  {confirmResult.skipped > 0 &&
                    `${confirmResult.skipped} skipped (already active).`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Batch ID: <span className="font-mono">{confirmResult.batchId}</span>
                </p>
              </div>
              <Button onClick={onClose}>Done</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
