'use client';

import { Badge, statusBadgeVariant } from '@/components/ui/badge';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending Review',
  PENDING_APPROVAL: 'Pending Approval',
  REJECTED: 'Rejected',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  DORMANT: 'Dormant',
  CLOSED: 'Closed',
  PENDING: 'Pending',
};

interface MerchantStatusBadgeProps {
  status: string;
  className?: string;
}

export function MerchantStatusBadge({ status, className }: MerchantStatusBadgeProps) {
  return (
    <Badge variant={statusBadgeVariant(status)} className={className}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
