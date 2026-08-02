'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import type { ApprovalTask } from '@/lib/approvals-api';
import {
  formatOnboardingStatus,
  type OnboardingApplication,
} from '@/lib/onboarding-api';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export interface ApprovalDetailDrawerProps {
  open: boolean;
  variant?: 'merchant' | 'school';
  task: ApprovalTask | null;
  application: OnboardingApplication | null;
  loading?: boolean;
  busy?: boolean;
  canApprove?: boolean;
  canReject?: boolean;
  canSendBack?: boolean;
  onClose: () => void;
  onApprove: (notes?: string) => Promise<void>;
  onReject: (notes?: string) => Promise<void>;
  onRequestInfo?: (notes: string) => Promise<void>;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value?.trim() || '—'}</p>
    </div>
  );
}

export function ApprovalDetailDrawer({
  open,
  variant = 'merchant',
  task,
  application,
  loading,
  busy,
  canApprove,
  canReject,
  canSendBack,
  onClose,
  onApprove,
  onReject,
  onRequestInfo,
}: ApprovalDetailDrawerProps) {
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const merchant = application?.merchant;
  const profile = merchant?.profile;
  const docs = merchant?.documents ?? [];
  const isPending = task?.status === 'PENDING';
  const isSchool = variant === 'school' || merchant?.isSchool;
  const reviewTitle = isSchool ? 'School approval review' : 'Merchant approval review';
  const approveButtonLabel = isSchool ? 'Approve school' : 'Approve merchant';
  const openRecordLabel = isSchool ? 'Open full school onboarding record' : 'Open full onboarding record';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {reviewTitle}
            </p>
            <h2 className="truncate text-lg font-semibold text-foreground">
              {merchant?.tradingName || merchant?.legalName || 'Loading…'}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {task && (
                <Badge variant={statusBadgeVariant(task.status)}>{task.status}</Badge>
              )}
              {application && (
                <Badge variant={statusBadgeVariant(application.status)}>
                  {formatOnboardingStatus(application.status)}
                </Badge>
              )}
              {isSchool ? (
                <Badge variant="info">School</Badge>
              ) : (
                <Badge variant="outline">Retail</Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading merchant details…</p>
          ) : !application ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Could not load onboarding details for this task.
            </p>
          ) : (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={isSchool ? 'School / trading name' : 'Business / trading name'}
                  value={merchant?.tradingName}
                />
                <Field label="Legal name" value={merchant?.legalName} />
                <Field
                  label={isSchool ? 'Head / contact person' : 'Owner / contact person'}
                  value={merchant?.contactPerson}
                />
                <Field label="Email" value={profile?.contactEmail} />
                <Field label="Phone" value={profile?.contactPhone} />
                <Field
                  label={isSchool ? 'Institution type' : 'Business type'}
                  value={isSchool ? 'School' : application.legalEntityType}
                />
                <Field label="MCC" value={merchant?.mcc} />
                <Field label="Registration date" value={formatDateTime(application.createdAt)} />
                <Field label="Application no." value={application.applicationNo} />
                <Field
                  label="Verification status"
                  value={formatOnboardingStatus(application.status)}
                />
                <Field
                  label="Approval task"
                  value={task ? `${task.entityType.replace(/_/g, ' ')} · ${task.status}` : null}
                />
                <Field
                  label="Task created"
                  value={task ? formatDateTime(task.createdAt) : null}
                />
              </section>

              {(profile?.city || profile?.region || profile?.addressLine1) && (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Address</h3>
                    <p className="text-sm text-muted-foreground">
                      {[
                        profile?.addressLine1,
                        profile?.addressLine2,
                        profile?.ward,
                        profile?.district,
                        profile?.region,
                        profile?.city,
                        profile?.postalCode,
                      ]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </p>
                  </section>
                </>
              )}

              <Separator />
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Uploaded documents</h3>
                  <Badge variant="outline">{docs.length} file{docs.length === 1 ? '' : 's'}</Badge>
                </div>
                {docs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                ) : (
                  <ul className="space-y-2">
                    {docs.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{doc.fileName}</p>
                            <p className="text-xs text-muted-foreground">{doc.docType}</p>
                          </div>
                        </div>
                        <Badge variant={statusBadgeVariant(doc.verificationStatus)}>
                          {doc.verificationStatus}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {merchant?.settlementAccount && (
                <>
                  <Separator />
                  <section className="grid gap-4 sm:grid-cols-2">
                    <Field label="Settlement account" value={merchant.settlementAccount.accountNumber} />
                    <Field label="Account name" value={merchant.settlementAccount.accountName} />
                    <Field label="Bank code" value={merchant.settlementAccount.bankCode} />
                    <Field
                      label="Account verified"
                      value={
                        merchant.settlementAccount.verifiedAt
                          ? formatDateTime(merchant.settlementAccount.verifiedAt)
                          : 'Not verified'
                      }
                    />
                  </section>
                </>
              )}

              {isPending && (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <Label htmlFor="approval-drawer-notes">Decision notes</Label>
                    <textarea
                      id="approval-drawer-notes"
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional compliance notes for the audit trail…"
                    />
                  </section>
                </>
              )}

              {task?.decision && (
                <>
                  <Separator />
                  <section className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-3">
                    <p className="text-sm font-semibold">Decision recorded</p>
                    <p className="text-sm">
                      {task.decision.decision} · {formatDateTime(task.decision.decidedAt)}
                    </p>
                    {task.decision.notes && (
                      <p className="text-sm text-muted-foreground">{task.decision.notes}</p>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </div>

        <footer className="space-y-3 border-t border-border px-5 py-4">
          {application && (
            <Link
              href={`/onboarding/${application.id}`}
              className="inline-flex items-center gap-1.5 text-sm text-link"
            >
              Open full onboarding record
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Close
            </Button>
            {isPending && canSendBack && onRequestInfo && (
              <Button
                variant="outline"
                disabled={busy || !notes.trim()}
                onClick={() => void onRequestInfo(notes.trim())}
              >
                Request info
              </Button>
            )}
            {isPending && canReject && (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => void onReject(notes.trim() || 'Rejected by checker')}
              >
                Reject
              </Button>
            )}
            {isPending && canApprove && (
              <Button disabled={busy} onClick={() => void onApprove(notes.trim() || undefined)}>
                {approveButtonLabel}
              </Button>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
}
