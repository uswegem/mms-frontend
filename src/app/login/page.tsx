'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock } from 'lucide-react';
import { AuthApiError } from '@/lib/auth-api';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState('admin@mms.local');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, showMfa ? mfaCode : undefined);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.mfaRequired) {
          setShowMfa(true);
          setError('Enter the 6-digit code from your authenticator app.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Login failed. Ensure the backend is running on port 3001.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-[var(--sidebar)] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">MMS Platform</p>
            <p className="text-xs text-sidebar-muted">Merchant Management System</p>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Enterprise Merchant<br />Management for<br />Tanzania&apos;s Payment Network
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-sidebar-muted">
            TANQR-compliant QR payments, TIPS integration, school fee collection,
            settlement, and reconciliation — built for banks and acquirers.
          </p>
          <div className="flex gap-6 text-xs text-sidebar-muted">
            <div>
              <p className="text-2xl font-semibold text-white">70+</p>
              <p>Database Tables</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">20</p>
              <p>Modules</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">137</p>
              <p>API Endpoints</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-sidebar-muted">
          Bank of Tanzania TANQR Standard · TIPS Aligned · BoT Examination Ready
        </p>
      </div>

      {/* Login form */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">MMS Platform</p>
              <p className="text-xs text-muted-foreground">Merchant Management System</p>
            </div>
          </div>

          <Card className="border-border shadow-[var(--shadow-lg)]">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <CardTitle>Sign in to your account</CardTitle>
              </div>
              <CardDescription>
                Secure access for acquirer staff and authorized personnel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@bank.co.tz"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                  />
                </div>
                {showMfa && (
                  <div className="space-y-2">
                    <Label htmlFor="mfaCode">Authenticator code</Label>
                    <Input
                      id="mfaCode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="000000"
                    />
                  </div>
                )}
                {error && <Alert variant="error">{error}</Alert>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Authenticating…' : 'Sign in'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Protected by enterprise-grade authentication · MFA supported
          </p>
        </div>
      </div>
    </div>
  );
}
