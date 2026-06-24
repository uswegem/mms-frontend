'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getBreadcrumbs } from '@/lib/navigation';

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:flex">
      <ol className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <li key={crumb.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            {crumb.href && i < crumbs.length - 1 ? (
              <Link
                href={crumb.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className={i === crumbs.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
