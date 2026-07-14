import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  showTagline?: boolean;
  collapsed?: boolean;
  variant?: 'sidebar' | 'login' | 'compact';
}

export function BrandLogo({
  className,
  imageClassName,
  showTagline = true,
  collapsed = false,
  variant = 'sidebar',
}: BrandLogoProps) {
  const heights = {
    sidebar: collapsed ? 32 : 40,
    login: 52,
    compact: 40,
  } as const;

  const height = heights[variant];

  if (collapsed && variant === 'sidebar') {
    return (
      <div
        className={cn('flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md', className)}
        title="Letshego Faidika Bank"
      >
        <Image
          src="/letshego-faidika-logo.png"
          alt="Letshego Faidika Bank"
          width={36}
          height={36}
          priority
          className={cn('h-9 w-auto max-w-none object-left object-contain', imageClassName)}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Image
        src="/letshego-faidika-logo.png"
        alt="Letshego Faidika Bank"
        width={Math.round(height * 3.4)}
        height={height}
        priority
        className={cn('h-auto w-auto object-contain', imageClassName)}
        style={{ maxHeight: height, width: 'auto' }}
      />
      {showTagline && variant === 'sidebar' && (
        <div className="min-w-0 border-l border-white/15 pl-3">
          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-[var(--brand-yellow)]">
            MMS Platform
          </p>
          <p className="truncate text-[10px] text-sidebar-muted">TANQR · TIPS · Tanzania</p>
        </div>
      )}
    </div>
  );
}
