import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type AlertVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

const variants: Record<AlertVariant, string> = {
  default: 'border-border bg-card text-foreground',
  success: 'border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]',
  error: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
  warning: 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]',
  info: 'border-[#bae6fd] bg-[#f0f9ff] text-[#0369a1]',
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
