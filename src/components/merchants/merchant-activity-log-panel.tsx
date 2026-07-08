'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusTimeline } from '@/components/merchants/status-timeline';
import { StatusHistoryTable } from '@/components/merchants/status-history-table';
import { getStatusHistory } from '@/lib/merchant-status-api';

interface MerchantActivityLogPanelProps {
  merchantId: string;
  currentStatus: string;
  token: string;
}

export function MerchantActivityLogPanel({
  merchantId,
  currentStatus,
  token,
}: MerchantActivityLogPanelProps) {
  const historyQuery = useQuery({
    queryKey: ['status-history', merchantId],
    queryFn: () => getStatusHistory(token, merchantId),
    enabled: !!token,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Timeline</CardTitle>
          <CardDescription>Chronological view of status transitions</CardDescription>
        </CardHeader>
        <CardContent>
          <StatusTimeline history={historyQuery.data ?? []} currentStatus={currentStatus} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Log</CardTitle>
          <CardDescription>Immutable audit trail of all status changes</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <StatusHistoryTable history={historyQuery.data ?? []} loading={historyQuery.isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
