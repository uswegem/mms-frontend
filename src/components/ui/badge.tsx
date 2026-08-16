import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-muted text-foreground ring-border',
        primary: 'bg-[var(--accent-muted)] text-[var(--brand-black)] ring-[color-mix(in_srgb,var(--brand-yellow)_50%,transparent)]',
        success: 'bg-[var(--success-muted)] text-[var(--success)] ring-[var(--success-border)]',
        warning: 'bg-[var(--warning-muted)] text-[var(--warning)] ring-[var(--warning-border)]',
        danger: 'bg-[var(--destructive-muted)] text-[var(--destructive)] ring-[var(--destructive-border)]',
        info: 'bg-[var(--info-muted)] text-[var(--info)] ring-[var(--info-border)]',
        outline: 'bg-transparent text-muted-foreground ring-border',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export function statusBadgeVariant(
  status: string,
): VariantProps<typeof badgeVariants>['variant'] {
  const map: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
    ACTIVE: 'success',
    SUCCESS: 'success',
    APPROVED: 'success',
    POSTED: 'success',
    PAID: 'success',
    COMPLETED: 'success',
    UNPAID: 'danger',
    PARTIALLY_PAID: 'warning',
    CANCELLED: 'outline',
    PENDING: 'warning',
    PENDING_REVIEW: 'warning',
    PENDING_APPROVAL: 'warning',
    SUBMITTED: 'warning',
    UNDER_REVIEW: 'warning',
    DRAFT: 'default',
    SUSPENDED: 'danger',
    FAILED: 'danger',
    REJECTED: 'danger',
    CLOSED: 'outline',
    DORMANT: 'info',
    PARTIAL: 'warning',
    INACTIVE: 'outline',
    DEACTIVATED: 'outline',
  };
  return map[status] ?? 'default';
}
