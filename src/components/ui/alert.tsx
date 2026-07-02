import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type AlertVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

const variants: Record<AlertVariant, string> = {
  default: 'border-border bg-card text-foreground',
  success: 'border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success)]',
  error: 'border-[var(--destructive-border)] bg-[var(--destructive-muted)] text-[var(--destructive)]',
  warning: 'border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning)]',
  info: 'border-[var(--info-border)] bg-[var(--info-muted)] text-[var(--info)]',
};

const icons: Record<AlertVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
  warning: <AlertCircle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
};

export function Alert({
  variant = 'default',
  children,
  onDismiss,
  className,
}: {
  variant?: AlertVariant;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        variants[variant],
        className,
      )}
      role="alert"
    >
      <span className="mt-0.5 shrink-0">{icons[variant]}</span>
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
