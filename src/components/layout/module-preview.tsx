import { type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ModulePreviewProps {
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  phase?: string;
}

export function ModulePreview({
  title,
  description,
  icon: Icon,
  features,
  phase = 'Milestone 3+',
}: ModulePreviewProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description}>
        <Badge variant="warning">{phase}</Badge>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="h-5 w-5 text-[var(--brand-navy)]" />
              Module Overview
            </CardTitle>
            <CardDescription>
              This module is fully specified in the architecture and ready for implementation.
              Backend APIs are defined in the OpenAPI specification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
              <p className="text-3xl font-semibold text-[var(--brand-navy)]">—</p>
              <p className="mt-1 text-xs text-muted-foreground">Live data pending API</p>
            </div>
            <p className="text-xs text-muted-foreground">
              UI shell is production-ready. Data integration will activate when the corresponding
              backend module ships.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
