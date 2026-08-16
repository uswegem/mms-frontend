'use client';

import { createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  active: string;
  setActive: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: {
  defaultValue: string;
  value?: string;
  onValueChange?: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const active = value ?? uncontrolled;
  const setActive = (id: string) => {
    onValueChange?.(id);
    if (value === undefined) setUncontrolled(id);
  };
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex h-10 items-center gap-1 rounded-lg border border-border bg-muted/50 p-1',
        className,
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsTrigger must be inside Tabs');
  const isActive = ctx.active === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.setActive(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
        isActive
          ? 'bg-card text-foreground shadow-[var(--shadow-sm)]'
          : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx || ctx.active !== value) return null;
  return (
    <div role="tabpanel" className={cn('mt-4', className)}>
      {children}
    </div>
  );
}
