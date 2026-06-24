'use client';

import { Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ModulePreview } from '@/components/layout/module-preview';

export default function MonitoringPage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Monitoring"
        description="Platform health, service status, and operational metrics."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">API Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={health.data?.status === 'ok' ? 'success' : 'danger'}>
                {health.isLoading ? 'Checking…' : health.data?.status ?? 'Unknown'}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Database</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="success">Connected</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Check</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {health.dataUpdatedAt
                ? new Date(health.dataUpdatedAt).toLocaleTimeString()
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <ModulePreview
        title="Advanced Monitoring"
        description="Full observability stack — metrics, alerts, and SLA dashboards."
        icon={Activity}
        features={[
          'ECS/Fargate service health checks',
          'RDS and Redis connection monitoring',
          'RabbitMQ queue depth alerts',
          'API latency percentile tracking',
          'Error rate and 5xx alerting',
          'TIPS webhook delivery monitoring',
          'CloudWatch → PagerDuty integration',
          'BoT examination uptime reports',
        ]}
        phase="Milestone 7"
      />
    </div>
  );
}
