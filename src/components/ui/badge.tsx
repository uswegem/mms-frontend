import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-700 ring-slate-200',
        primary: 'bg-[#eff6ff] text-[#1e40af] ring-[#bfdbfe]',
        success: 'bg-[#ecfdf5] text-[#047857] ring-[#a7f3d0]',
        warning: 'bg-[#fffbeb] text-[#b45309] ring-[#fde68a]',
        danger: 'bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]',
        info: 'bg-[#f0f9ff] text-[#0369a1] ring-[#bae6fd]',
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
