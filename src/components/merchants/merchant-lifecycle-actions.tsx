'use client';

import { Button } from '@/components/ui/button';
import type { Merchant } from '@/lib/merchants-api';

interface MerchantLifecycleActionsProps {
  merchant: Pick<Merchant, 'id' | 'status'>;
  canSuspend: boolean;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
  onDormant: (id: string) => void;
  size?: 'sm' | 'default';
  layout?: 'inline' | 'stack';
}

export function MerchantLifecycleActions({
  merchant,
  canSuspend,
  onSuspend,
  onActivate,
  onDormant,
  size = 'sm',
  layout = 'inline',
}: MerchantLifecycleActionsProps) {
  if (!canSuspend) return null;

  const wrapClass =
    layout === 'stack' ? 'flex flex-wrap gap-3' : 'flex justify-end gap-1';

  const activatable = ['SUSPENDED', 'DORMANT'].includes(merchant.status);

  return (
    <div className={wrapClass}>
      {merchant.status === 'ACTIVE' && (
        <>
          <Button variant="ghost" size={size} onClick={() => onSuspend(merchant.id)}>
            Suspend
          </Button>
          <Button variant="ghost" size={size} onClick={() => onDormant(merchant.id)}>
            Dormant
          </Button>
        </>
      )}
      {activatable && (
        <Button variant="ghost" size={size} onClick={() => onActivate(merchant.id)}>
          Activate
        </Button>
      )}
    </div>
  );
}
