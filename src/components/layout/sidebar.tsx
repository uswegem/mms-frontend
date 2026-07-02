'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { filterNavByPermissions, NAV_SECTIONS } from '@/lib/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BrandLogo } from '@/components/layout/brand-logo';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  permissions: string[];
}

export function Sidebar({ collapsed, onToggle, permissions }: SidebarProps) {
  const pathname = usePathname();
  const sections = filterNavByPermissions(NAV_SECTIONS, permissions);

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        collapsed ? 'w-[72px]' : 'w-[260px]',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <BrandLogo collapsed={collapsed} variant="sidebar" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, si) => (
          <div key={section.label} className={si > 0 ? 'mt-6' : ''}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-[var(--brand-yellow)]'
                          : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-[var(--brand-yellow)]')} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <Badge variant="outline" className="text-[10px] ring-white/20 text-sidebar-muted">
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Collapse toggle */}
      <div className="p-3">
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          onClick={onToggle}
          className={cn(
            'w-full text-sidebar-muted hover:bg-white/5 hover:text-white',
            !collapsed && 'justify-start',
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
