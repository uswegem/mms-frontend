'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface RejectReasonCode {
  code: string;
  label: string;
}

export const ONBOARDING_REJECTION_CODES: RejectReasonCode[] = [
  { code: 'INCOMPLETE_KYC', label: 'KYC documents incomplete or missing' },
  { code: 'INVALID_DOCUMENTS', label: 'Documents invalid, expired, or fraudulent' },
  { code: 'RISK_FLAG', label: 'Application flagged for risk reasons' },
  { code: 'DUPLICATE_APPLICATION', label: 'Duplicate entity detected' },
  { code: 'BLACKLISTED', label: 'Applicant or entity is blacklisted' },
  { code: 'INSUFFICIENT_INFO', label: 'Insufficient business information' },
  { code: 'OTHER', label: 'Other (explain in remarks)' },
];

interface RejectModalProps {
  open: boolean;
  title: string;
  description?: string;
  /** If provided, renders a reason-code select above the remarks field. */
  reasonCodes?: RejectReasonCode[];
  remarksLabel?: string;
  remarksRequired?: boolean;
  onClose: () => void;
  onConfirm: (params: { code?: string; remarks: string }) => Promise<void>;
  loading?: boolean;
}

export function RejectModal({
  open,
  title,
  description,
  reasonCodes,
  remarksLabel = 'Remarks',
  remarksRequired = true,
  onClose,
  onConfirm,
  loading,
}: RejectModalProps) {
  const [code, setCode] = useState(reasonCodes?.[0]?.code ?? '');
  const [remarks, setRemarks] = useState('');

  if (!open) return null;

  const canSubmit = remarksRequired ? remarks.trim().length > 0 : true;

  function handleClose() {
    setCode(reasonCodes?.[0]?.code ?? '');
    setRemarks('');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}

        <div className="mt-4 space-y-4">
          {reasonCodes && reasonCodes.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="reject-code">Reason code</Label>
              <select
                id="reject-code"
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              >
                {reasonCodes.map((rc) => (
                  <option key={rc.code} value={rc.code}>
                    {rc.code} — {rc.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reject-remarks">
              {remarksLabel}
              {remarksRequired && <span className="ml-1 text-destructive">*</span>}
            </Label>
            <textarea
              id="reject-remarks"
              rows={4}
              className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={
                remarksRequired
                  ? 'Describe the issue so the applicant can correct it…'
                  : 'Optional additional context…'
              }
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={loading || !canSubmit}
            onClick={() =>
              void onConfirm({ code: reasonCodes ? code : undefined, remarks: remarks.trim() })
            }
          >
            {loading ? 'Submitting…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}
