'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/providers/auth-provider';
import {
  bulkUploadStudents,
  createStudent,
  listStudents,
} from '@/lib/students-api';

interface SchoolStudentsPanelProps {
  merchantId: string;
}

export function SchoolStudentsPanel({ merchantId }: SchoolStudentsPanelProps) {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [admissionNo, setAdmissionNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canWrite = user?.permissions?.includes('school:student:write');
  const canBulk = user?.permissions?.includes('school:student:bulk');
  const canRead = user?.permissions?.includes('school:student:read');

  const studentsQuery = useQuery({
    queryKey: ['students', merchantId],
    queryFn: () => listStudents(accessToken!, merchantId),
    enabled: !!accessToken && canRead,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createStudent(accessToken, merchantId, {
        admissionNo,
        fullName,
        guardianPhone: guardianPhone || undefined,
      });
      setMessage(
        `Student enrolled — permanent Lipa Namba: ${result.alias.alias8digit}`,
      );
      setAdmissionNo('');
      setFullName('');
      setGuardianPhone('');
      await queryClient.invalidateQueries({ queryKey: ['students', merchantId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enrol student');
    } finally {
      setLoading(false);
    }
  }

  async function handleBulk(file: File) {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await bulkUploadStudents(accessToken, merchantId, file);
      setMessage(
        `Bulk upload: ${result.created} created, ${result.reactivated} reactivated, ${result.errors} errors`,
      );
      await queryClient.invalidateQueries({ queryKey: ['students', merchantId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk upload failed');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (!canRead) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to view students.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Enrol Student
            </CardTitle>
            <CardDescription>
              Issues permanent Lipa Namba, internal routing ID, and static TANQR.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="admissionNo">Admission No</Label>
                <Input
                  id="admissionNo"
                  value={admissionNo}
                  onChange={(e) => setAdmissionNo(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardianPhone">Guardian Phone</Label>
                <Input
                  id="guardianPhone"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={loading}>
                  Enrol &amp; Generate Alias
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {canBulk && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" />
              Bulk Student Upload
            </CardTitle>
            <CardDescription>
              CSV columns: admission_no, full_name, guardian_phone (optional).
              Returning students reactivate existing aliases only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleBulk(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
            >
              Upload CSV
            </Button>
          </CardContent>
        </Card>
      )}

      {message && <p className="text-sm text-[var(--brand-black)]">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student Registry</CardTitle>
        </CardHeader>
        <CardContent>
          {studentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading students…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admission</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Lipa Namba</TableHead>
                  <TableHead>Internal ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(studentsQuery.data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.admissionNo}</TableCell>
                    <TableCell>{s.fullName}</TableCell>
                    <TableCell className="font-mono">
                      {s.studentAlias?.alias8digit ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.studentAlias?.internalId8digit ?? '—'}
                    </TableCell>
                    <TableCell>
                      {s.studentAlias?.isActive ? 'Active' : 'Inactive'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
