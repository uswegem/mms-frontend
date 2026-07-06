import { Badge } from '@/components/ui/badge';
import type { QrStatus } from '@/types/merchant-qr';

export function QrStatusBadge({ status }: { status: QrStatus | string }) {
  const normalized = status.toLowerCase();
  const variant =
    normalized === 'active' || normalized === 'paid'
      ? 'success'
      : normalized === 'pending'
        ? 'warning'
        : normalized === 'expired' || normalized === 'disabled'
          ? 'outline'
          : 'default';

  return (
    <Badge variant={variant} className="uppercase">
      {normalized}
    </Badge>
  );
}
