'use client';

import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, UserPlus, UserRoundPlus } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { Badge, statusBadgeVariant } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  assignRoles,
  createUser,
  deactivateUser,
  inviteUser,
  listRoles,
  listUsers,
  RoleListItem,
  User,
  UsersApiError,
} from '@/lib/users-api';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuth();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createRoleId, setCreateRoleId] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');

  const canWrite = user?.permissions?.includes('user:write');
  const canInvite = user?.permissions?.includes('user:invite');
  const canDeactivate = user?.permissions?.includes('user:deactivate');
  const canAssignRoles = user?.permissions?.includes('user:role:assign');

  const usersQuery = useQuery({
    queryKey: ['users', page],
    queryFn: () => listUsers(accessToken!, page, 20),
    enabled: !!accessToken,
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => listRoles(accessToken!),
    enabled: !!accessToken,
  });

  const token = accessToken!;
  const roles = rolesQuery.data ?? [];
  const users = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;

  function handleApiError(err: unknown) {
    setError(err instanceof UsersApiError ? err.message : 'An unexpected error occurred');
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setTempPassword(null);

    if (createPassword !== createPasswordConfirm) {
      setError('Password and confirm password do not match.');
      return;
    }

    try {
      const result = await createUser(token, {
        email: createEmail,
        fullName: createName,
        roleIds: [createRoleId],
        password: createPassword,
      });
      const action = result.reactivated ? 'reactivated' : 'created';
      setSuccess(
        result.emailSent
          ? `User ${result.user.email} ${action}. Login credentials were sent to their email.`
          : `User ${result.user.email} ${action}. They can sign in with the password you set.`,
      );
      if (result.temporaryPassword) setTempPassword(result.temporaryPassword);
      setCreateEmail('');
      setCreateName('');
      setCreateRoleId('');
      setCreatePassword('');
      setCreatePasswordConfirm('');
      setShowCreate(false);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setInviteToken(null);
    try {
      const result = await inviteUser(token, { email: inviteEmail, roleId: inviteRoleId });
      setSuccess(result.message);
      if (result.inviteToken) setInviteToken(result.inviteToken);
      setInviteEmail('');
      setInviteRoleId('');
      setShowInvite(false);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleDeactivate(target: User) {
    if (!confirm(`Deactivate ${target.email}?`)) return;
    setError(null);
    try {
      await deactivateUser(token, target.id);
      setSuccess(`${target.email} deactivated.`);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleAssignRole(target: User, role: RoleListItem) {
    setError(null);
    try {
      await assignRoles(token, target.id, [role.id]);
      setSuccess(`Assigned ${role.name} to ${target.email}.`);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      handleApiError(err);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage platform users, invitations, and role assignments."
      >
        {canWrite && (
          <Button onClick={() => { setShowCreate((s) => !s); setShowInvite(false); }}>
            <UserPlus className="h-4 w-4" /> Create User
          </Button>
        )}
        {canInvite && (
          <Button variant="outline" onClick={() => { setShowInvite((s) => !s); setShowCreate(false); }}>
            <UserRoundPlus className="h-4 w-4" /> Invite
          </Button>
        )}
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4" /> Export
        </Button>
      </PageHeader>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess(null)}>{success}</Alert>}
      {tempPassword && (
        <Alert variant="warning">
          Email could not be sent. Temporary password (dev):{' '}
          <code className="font-mono">{tempPassword}</code>. Share it with the user now, or ask
          them to use Forgot password on the login page to set a new one.
        </Alert>
      )}
      {inviteToken && (
        <Alert variant="warning">
          Invite token (dev): <code className="break-all font-mono text-xs">{inviteToken}</code>
        </Alert>
      )}

      {showCreate && canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create User</CardTitle>
            <CardDescription>
              Creates an active user with the login password you set below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-name">Full Name</Label>
                <Input
                  id="create-name"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">Role</Label>
                <Select
                  id="create-role"
                  required
                  value={createRoleId}
                  onChange={(e) => setCreateRoleId(e.target.value)}
                >
                  <option value="">Select role…</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <p className="text-xs text-muted-foreground">
                  Password must be at least 12 characters and include uppercase,
                  lowercase, a number, and a special character (e.g.{' '}
                  <code className="font-mono">Ops@12345678</code>).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Password</Label>
                <Input
                  id="create-password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password-confirm">Confirm Password</Label>
                <Input
                  id="create-password-confirm"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={createPasswordConfirm}
                  onChange={(e) => setCreatePasswordConfirm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={rolesQuery.isLoading}>
                  Create
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showInvite && canInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite User</CardTitle>
            <CardDescription>Send an invitation to join the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select id="invite-role" required value={inviteRoleId} onChange={(e) => setInviteRoleId(e.target.value)}>
                  <option value="">Select role…</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={rolesQuery.isLoading}>Send Invite</Button>
                <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Users</CardTitle>
          <CardDescription>{meta ? `${meta.total} users registered` : 'Loading…'}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {usersQuery.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading users…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(u.status)}>{u.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r.id} variant="primary">{r.name}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canAssignRoles && u.id !== user?.sub && (
                          <Select
                            defaultValue=""
                            className="h-8 w-36 text-xs"
                            onChange={(e) => {
                              const role = roles.find((r) => r.id === e.target.value);
                              if (role) void handleAssignRole(u, role);
                              e.target.value = '';
                            }}
                          >
                            <option value="">Assign role…</option>
                            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </Select>
                        )}
                        {canDeactivate && u.status === 'ACTIVE' && u.id !== user?.sub && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeactivate(u)}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {meta && meta.total > meta.limit && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {meta.page} of {Math.ceil(meta.total / meta.limit)}</span>
              <Button variant="outline" size="sm" disabled={page * meta.limit >= meta.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
