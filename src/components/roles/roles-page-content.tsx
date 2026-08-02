'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Shield, Trash2 } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { hasPermission } from '@/lib/permissions';
import {
  assignRolePermissions,
  createAuthzRole,
  createPolicyOverride,
  deleteAuthzRole,
  getAuthzRole,
  getMyPermissions,
  getUserEffectivePermissions,
  listAuthzRoles,
  listPermissionCatalog,
  listPolicyOverrides,
  revokePolicyOverride,
  updateAuthzRole,
  type RoleListItem,
} from '@/lib/authz-api';
import { listUsers } from '@/lib/users-api';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN: 'Full platform access — acquirer tier',
  BANK_ADMIN: 'Acquirer administration and configuration',
  OPERATIONS_USER: 'Day-to-day merchant and payment operations',
  MERCHANT_ADMIN: 'Merchant portal — own merchant management',
  MERCHANT_USER: 'Merchant portal — limited read access',
  SCHOOL_ADMIN: 'School fee collection and student management',
};

export function RolesPageContent() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({ code: '', name: '' });
  const [editName, setEditName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [debugUserId, setDebugUserId] = useState('');
  const [overrideForm, setOverrideForm] = useState({
    userId: '',
    permissionCode: '',
    effect: 'ALLOW' as 'ALLOW' | 'DENY',
    reason: '',
  });

  const canRead = hasPermission(user?.permissions, 'authz:role:read');
  const canWrite = hasPermission(user?.permissions, 'authz:role:write');
  const canReadPerms = hasPermission(user?.permissions, 'authz:permission:read');
  const canOverride = hasPermission(user?.permissions, 'authz:policy:override');
  const canMe = hasPermission(user?.permissions, 'authz:me');

  const rolesQuery = useQuery({
    queryKey: ['authz-roles'],
    queryFn: () => listAuthzRoles(accessToken!),
    enabled: !!accessToken && canRead,
  });

  const catalogQuery = useQuery({
    queryKey: ['authz-permissions'],
    queryFn: () => listPermissionCatalog(accessToken!),
    enabled: !!accessToken && canReadPerms,
  });

  const roleDetailQuery = useQuery({
    queryKey: ['authz-role', selectedRoleId],
    queryFn: () => getAuthzRole(accessToken!, selectedRoleId!),
    enabled: !!accessToken && !!selectedRoleId && canRead,
  });

  const myPermsQuery = useQuery({
    queryKey: ['authz-me-permissions'],
    queryFn: () => getMyPermissions(accessToken!),
    enabled: !!accessToken && canMe,
  });

  const overridesQuery = useQuery({
    queryKey: ['authz-policy-overrides'],
    queryFn: () => listPolicyOverrides(accessToken!),
    enabled: !!accessToken && canOverride,
  });

  const usersQuery = useQuery({
    queryKey: ['users-for-authz'],
    queryFn: () => listUsers(accessToken!, 1, 100),
    enabled: !!accessToken && canOverride,
  });

  const debugQuery = useQuery({
    queryKey: ['authz-effective', debugUserId],
    queryFn: () => getUserEffectivePermissions(accessToken!, debugUserId),
    enabled: !!accessToken && !!debugUserId && canRead,
  });

  const permissionsByModule = useMemo(() => {
    const map = new Map<string, typeof catalogQuery.data>();
    for (const p of catalogQuery.data ?? []) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return map;
  }, [catalogQuery.data]);

  function onSelectRole(role: RoleListItem) {
    setSelectedRoleId(role.id);
    setEditName(role.name);
  }

  useEffect(() => {
    if (roleDetailQuery.data) {
      setSelectedPerms(roleDetailQuery.data.permissions);
    }
  }, [roleDetailQuery.data]);

  async function runMutation(label: string, fn: () => Promise<unknown>) {
    setError(null);
    setSuccess(null);
    try {
      await fn();
      setSuccess(label);
      await queryClient.invalidateQueries({ queryKey: ['authz-roles'] });
      await queryClient.invalidateQueries({ queryKey: ['authz-role'] });
      await queryClient.invalidateQueries({ queryKey: ['authz-me-permissions'] });
      await queryClient.invalidateQueries({ queryKey: ['authz-policy-overrides'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    }
  }

  async function handleCreateRole(e: FormEvent) {
    e.preventDefault();
    await runMutation('Role created', () =>
      createAuthzRole(accessToken!, newRole).then(() => {
        setNewRole({ code: '', name: '' });
      }),
    );
  }

  if (!canRead) {
    return (
      <p className="py-20 text-center text-sm text-muted-foreground">
        You need authz:role:read permission.
      </p>
    );
  }

  const roles = rolesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Manage RBAC roles, permission catalog, policy overrides, and effective permission debug."
      />

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess(null)}>{success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Shield className="h-8 w-8 text-[var(--brand-navy)]" />
            <div>
              <p className="text-xs text-muted-foreground">Roles</p>
              <p className="text-2xl font-semibold">{roles.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Your Roles</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(myPermsQuery.data?.roles ?? user?.roles ?? []).map((r) => (
                <Badge key={r} variant="primary">{r}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Effective Permissions</p>
            <p className="mt-2 text-2xl font-semibold">
              {myPermsQuery.data?.permissions.length ?? user?.permissions?.length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          {canReadPerms && <TabsTrigger value="catalog">Permission Catalog</TabsTrigger>}
          {canOverride && <TabsTrigger value="overrides">Policy Overrides</TabsTrigger>}
          {canMe && <TabsTrigger value="mine">My Permissions</TabsTrigger>}
          {canRead && <TabsTrigger value="debug">Effective Debug</TabsTrigger>}
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          {canWrite && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create Custom Role</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateRole} className="flex flex-wrap gap-3">
                  <div className="space-y-1">
                    <Label>Code</Label>
                    <Input
                      required
                      placeholder="COMPLIANCE_OFFICER"
                      value={newRole.code}
                      onChange={(e) => setNewRole({ ...newRole, code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      required
                      placeholder="Compliance Officer"
                      value={newRole.name}
                      onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit"><Plus className="h-4 w-4" /> Create</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Role Directory</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((r) => (
                      <TableRow
                        key={r.id}
                        className={selectedRoleId === r.id ? 'bg-muted/50' : 'cursor-pointer'}
                        onClick={() => onSelectRole(r)}
                      >
                        <TableCell className="font-mono text-xs">{r.code}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>
                          <Badge variant={r.isSystem ? 'primary' : 'outline'}>
                            {r.isSystem ? 'System' : 'Custom'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Role Detail</CardTitle>
                <CardDescription>
                  {selectedRoleId
                    ? roleDetailQuery.data?.code
                    : 'Select a role to view or edit permissions'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedRoleId && (
                  <p className="text-sm text-muted-foreground">No role selected.</p>
                )}
                {selectedRoleId && roleDetailQuery.data && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {ROLE_DESCRIPTIONS[roleDetailQuery.data.code] ?? 'Platform role'} ·{' '}
                      {roleDetailQuery.data.assignedUserCount} users assigned
                    </p>
                    {canWrite && !roleDetailQuery.data.isSystem && (
                      <div className="flex flex-wrap gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="max-w-xs"
                        />
                        <Button
                          size="sm"
                          onClick={() =>
                            runMutation('Role updated', () =>
                              updateAuthzRole(accessToken!, selectedRoleId, { name: editName }),
                            )
                          }
                        >
                          Save name
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            runMutation('Role deleted', () =>
                              deleteAuthzRole(accessToken!, selectedRoleId).then(() => {
                                setSelectedRoleId(null);
                              }),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                      </div>
                    )}
                    {canWrite && !roleDetailQuery.data.isSystem && canReadPerms && (
                      <div className="max-h-64 space-y-2 overflow-y-auto rounded border border-border p-3">
                        {[...permissionsByModule.entries()].map(([module, perms]) => (
                          <div key={module}>
                            <p className="text-xs font-semibold uppercase text-muted-foreground">{module}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {perms?.map((p) => (
                                <label key={p.id} className="flex items-center gap-1 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={selectedPerms.includes(p.code)}
                                    onChange={(e) => {
                                      setSelectedPerms((prev) =>
                                        e.target.checked
                                          ? [...prev, p.code]
                                          : prev.filter((c) => c !== p.code),
                                      );
                                    }}
                                  />
                                  {p.code}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() =>
                            runMutation('Permissions updated', () =>
                              assignRolePermissions(accessToken!, selectedRoleId, selectedPerms),
                            )
                          }
                        >
                          Save permissions
                        </Button>
                      </div>
                    )}
                    {(roleDetailQuery.data.isSystem || !canWrite) && (
                      <div className="flex flex-wrap gap-1">
                        {roleDetailQuery.data.permissions.map((p) => (
                          <Badge key={p} variant="outline" className="font-mono text-xs">{p}</Badge>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {canReadPerms && (
          <TabsContent value="catalog">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Permission Catalog</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[...permissionsByModule.entries()].map(([module, perms]) => (
                  <div key={module}>
                    <h4 className="text-sm font-medium">{module}</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {perms?.map((p) => (
                        <Badge key={p.id} variant="outline" className="font-mono text-xs" title={p.description ?? ''}>
                          {p.code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canOverride && (
          <TabsContent value="overrides" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create Policy Override</CardTitle>
                <CardDescription>Per-user ALLOW or DENY exceptions (Redis-cached effective permissions)</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-3 md:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void runMutation('Policy override created', () =>
                      createPolicyOverride(accessToken!, overrideForm),
                    );
                  }}
                >
                  <div className="space-y-1">
                    <Label>User</Label>
                    <Select
                      value={overrideForm.userId}
                      onChange={(e) => setOverrideForm({ ...overrideForm, userId: e.target.value })}
                      required
                    >
                      <option value="">Select user…</option>
                      {(usersQuery.data?.data ?? []).map((u) => (
                        <option key={u.id} value={u.id}>{u.email}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Permission</Label>
                    <Select
                      value={overrideForm.permissionCode}
                      onChange={(e) => setOverrideForm({ ...overrideForm, permissionCode: e.target.value })}
                      required
                    >
                      <option value="">Select permission…</option>
                      {(catalogQuery.data ?? []).map((p) => (
                        <option key={p.id} value={p.code}>{p.code}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Effect</Label>
                    <Select
                      value={overrideForm.effect}
                      onChange={(e) =>
                        setOverrideForm({
                          ...overrideForm,
                          effect: e.target.value as 'ALLOW' | 'DENY',
                        })
                      }
                    >
                      <option value="ALLOW">ALLOW</option>
                      <option value="DENY">DENY</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Reason</Label>
                    <Input
                      value={overrideForm.reason}
                      onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit">Create override</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Active Overrides</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Permission</TableHead>
                      <TableHead>Effect</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overridesQuery.data ?? []).map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="text-xs">{o.user?.email ?? o.userId}</TableCell>
                        <TableCell className="font-mono text-xs">{o.permissionCode}</TableCell>
                        <TableCell>
                          <Badge variant={o.effect === 'ALLOW' ? 'success' : 'danger'}>{o.effect}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              runMutation('Override revoked', () =>
                                revokePolicyOverride(accessToken!, o.id),
                              )
                            }
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canMe && (
          <TabsContent value="mine">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">My Effective Permissions</CardTitle>
                <CardDescription>From GET /authz/me/permissions (includes policy overrides)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {myPermsQuery.data && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {myPermsQuery.data.permissions.map((p) => (
                        <Badge key={p} variant="outline" className="font-mono text-xs">{p}</Badge>
                      ))}
                    </div>
                    {myPermsQuery.data.storeIds.length > 0 && (
                      <p className="text-sm"><strong>Store scope:</strong> {myPermsQuery.data.storeIds.join(', ')}</p>
                    )}
                    {myPermsQuery.data.terminalIds.length > 0 && (
                      <p className="text-sm"><strong>Terminal scope:</strong> {myPermsQuery.data.terminalIds.join(', ')}</p>
                    )}
                    {myPermsQuery.data.deniedPermissions.length > 0 && (
                      <p className="text-sm text-destructive">
                        Denied overrides: {myPermsQuery.data.deniedPermissions.join(', ')}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canRead && (
          <TabsContent value="debug">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Effective Permissions Debug</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 max-w-md">
                  <Select value={debugUserId} onChange={(e) => setDebugUserId(e.target.value)}>
                    <option value="">Select user…</option>
                    {(usersQuery.data?.data ?? []).map((u) => (
                      <option key={u.id} value={u.id}>{u.email}</option>
                    ))}
                  </Select>
                </div>
                {debugQuery.data && (
                  <div className="space-y-2 text-sm">
                    <p><strong>Roles:</strong> {debugQuery.data.roles.join(', ')}</p>
                    <p><strong>Role permissions:</strong> {debugQuery.data.rolePermissions.length}</p>
                    <p><strong>Effective:</strong> {debugQuery.data.permissions.length}</p>
                    <div className="flex flex-wrap gap-1">
                      {debugQuery.data.permissions.map((p) => (
                        <Badge key={p} variant="outline" className="font-mono text-xs">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
