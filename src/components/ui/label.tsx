import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Renders a distinctly-styled required-field marker after the label text. */
  required?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none', className)}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-0.5 text-[var(--brand-gold-ink)]" aria-hidden="true">
          *
        </span>
      )}
    </label>
  ),
);
Label.displayName = 'Label';

export { Label };
