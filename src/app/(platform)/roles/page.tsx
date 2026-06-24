'use client';

import { useQuery } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listRoles } from '@/lib/users-api';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN: 'Full platform access — acquirer tier',
  BANK_ADMIN: 'Acquirer administration and configuration',
  OPERATIONS_USER: 'Day-to-day merchant and payment operations',
  MERCHANT_ADMIN: 'Merchant portal — own merchant management',
  MERCHANT_USER: 'Merchant portal — limited read access',
  SCHOOL_ADMIN: 'School fee collection and student management',
};

export default function RolesPage() {
  const { accessToken, user } = useAuth();

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => listRoles(accessToken!),
    enabled: !!accessToken,
  });

  const roles = rolesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="RBAC role definitions and permission assignments for the MMS platform."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">System Roles</p>
              <p className="text-2xl font-semibold">{roles.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Your Roles</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {user?.roles?.map((r) => (
                <Badge key={r} variant="primary">{r}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Your Permissions</p>
            <p className="mt-2 text-2xl font-semibold">{user?.permissions?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role Directory</CardTitle>
          <CardDescription>Phase 1 consolidated roles — expandable to full BRD role set in Phase 2</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rolesQuery.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading roles…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Code</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-medium">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ROLE_DESCRIPTIONS[r.code] ?? 'Platform role'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.code.startsWith('MERCHANT') || r.code === 'SCHOOL_ADMIN' ? 'info' : 'primary'}>
                        {r.code.startsWith('MERCHANT') || r.code === 'SCHOOL_ADMIN' ? 'Merchant' : 'Acquirer'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Permission Set</CardTitle>
          <CardDescription>Permissions granted to your current session via JWT</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {user?.permissions?.map((p) => (
              <Badge key={p} variant="outline" className="font-mono text-xs">{p}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
