'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  listKycReviews,
  listMerchantDocuments,
  reviewKyc,
  submitKyc,
  uploadKycDocument,
  type KycDocumentType,
  type Merchant,
} from '@/lib/merchants-api';
import { formatDateTime } from '@/lib/format';

const KYC_DOC_TYPES: { value: KycDocumentType; label: string }[] = [
  { value: 'KYC_ID', label: 'National ID / Passport' },
  { value: 'KYC_LICENSE', label: 'Business License' },
  { value: 'KYC_TIN', label: 'TIN Certificate' },
];

interface MerchantKycPanelProps {
  merchant: Merchant;
  merchantId: string;
  token: string;
  canKycWrite: boolean;
  canKycReview: boolean;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function MerchantKycPanel({
  merchant,
  merchantId,
  token,
  canKycWrite,
  canKycReview,
  onRefresh,
  onError,
  onSuccess,
}: MerchantKycPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<KycDocumentType>('KYC_ID');
  const [uploading, setUploading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const docsQuery = useQuery({
    queryKey: ['merchant-docs', merchantId],
    queryFn: () => listMerchantDocuments(token, merchantId),
    enabled: !!token,
  });

  const reviewsQuery = useQuery({
    queryKey: ['merchant-kyc-reviews', merchantId],
    queryFn: () => listKycReviews(token, merchantId),
    enabled: !!token,
  });

  const kycStatus = merchant.kyc?.status ?? 'PENDING';
  const canSubmit =
    canKycWrite &&
    ['PENDING', 'REJECTED', 'UNDER_REVIEW'].includes(kycStatus) &&
    merchant.status !== 'CLOSED';
  const canReview = canKycReview && kycStatus === 'SUBMITTED';

  async function handleFileSelect(file: File) {
    setUploading(true);
    try {
      await uploadKycDocument(token, merchantId, file, docType);
      onSuccess(`Document "${file.name}" registered.`);
      await docsQuery.refetch();
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSubmitKyc() {
    try {
      await submitKyc(token, merchantId);
      onSuccess('KYC submitted for compliance review.');
      await onRefresh();
      await docsQuery.refetch();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'KYC submission failed');
    }
  }

  async function handleReview(
    decision: 'APPROVED' | 'REJECTED' | 'MORE_INFO',
  ) {
    setReviewing(true);
    try {
      await reviewKyc(token, merchantId, decision, reviewNotes || undefined);
      onSuccess(`KYC ${decision.toLowerCase().replace('_', ' ')}.`);
      setReviewNotes('');
      await onRefresh();
      await reviewsQuery.refetch();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">KYC Documents</CardTitle>
            <CardDescription>
              Status:{' '}
              <Badge variant={statusBadgeVariant(kycStatus)}>{kycStatus}</Badge>
              {merchant.kyc?.submittedAt &&
                ` · Submitted ${formatDateTime(merchant.kyc.submittedAt)}`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {canSubmit && (
              <Button size="sm" onClick={() => void handleSubmitKyc()}>
                Submit for Review
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {canKycWrite && merchant.status !== 'CLOSED' && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
              <div className="space-y-2">
                <Label htmlFor="kyc-doc-type">Document Type</Label>
                <Select
                  id="kyc-doc-type"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as KycDocumentType)}
                  className="w-56"
                >
                  {KYC_DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={uploading}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelect(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Choose File'}
              </Button>
            </div>
          )}

          {docsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading documents…</p>
          ) : (docsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No KYC documents uploaded. Add at least one ID, license, or TIN document before
              submission.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docsQuery.data?.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Badge variant="primary">{d.docType}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{d.fileName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.fileSize ? `${Math.round(Number(d.fileSize) / 1024)} KB` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(d.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canReview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Review</CardTitle>
            <CardDescription>Approve, reject, or request more information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-notes">Review Notes</Label>
              <textarea
                id="review-notes"
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Optional notes for the merchant or audit trail…"
                className={cn(
                  'flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-[var(--shadow-sm)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={reviewing}
                onClick={() => void handleReview('APPROVED')}
              >
                Approve KYC
              </Button>
              <Button
                variant="outline"
                disabled={reviewing}
                onClick={() => void handleReview('MORE_INFO')}
              >
                Request More Info
              </Button>
              <Button
                variant="destructive"
                disabled={reviewing}
                onClick={() => void handleReview('REJECTED')}
              >
                Reject KYC
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(reviewsQuery.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Decision</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewsQuery.data?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(r.decision)}>{r.decision}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {r.notes ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(r.reviewedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
