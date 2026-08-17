'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import {
  AuthApiError,
  decodeJwt,
  forgotPassword,
  resetPassword,
} from '@/lib/auth-api';
import { postLoginRedirect } from '@/lib/permissions';
import { useAuth } from '@/providers/auth-provider';
import { BrandLogo } from '@/components/layout/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('admin@mms.local');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(postLoginRedirect(user?.roles));
    }
  }, [isLoading, isAuthenticated, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const result = await login(email, password, showMfa ? mfaCode : undefined);
      const claims = decodeJwt(result.accessToken);
      router.push(postLoginRedirect(claims?.roles));
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

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setDevResetToken(null);
    setSubmitting(true);
    try {
      const result = await forgotPassword(email);
      setSuccess(result.message);
      if (result.resetToken) {
        setDevResetToken(result.resetToken);
        setResetToken(result.resetToken);
        setMode('reset');
      }
    } catch (err) {
      setError(
        err instanceof AuthApiError
          ? err.message
          : 'Unable to start password reset.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(resetToken, newPassword);
      setSuccess('Password reset successful. You can now sign in.');
      setMode('login');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowMfa(false);
    } catch (err) {
      setError(
        err instanceof AuthApiError ? err.message : 'Password reset failed.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-[var(--sidebar)] p-12 text-white lg:flex">
        <BrandLogo variant="login" showTagline={false} />

        <div className="space-y-6">
          <p className="text-sm font-medium uppercase tracking-widest text-[var(--brand-yellow)]">
            Merchant Management System
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Enterprise payments &amp;<br />
            merchant operations<br />
            for Tanzania
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-sidebar-muted">
            TANQR-compliant QR payments, TIPS integration, school fee collection,
            settlement, and reconciliation — powered by Letshego Faidika Bank.
          </p>
          <div className="flex gap-6 text-xs text-sidebar-muted">
            <div>
              <p className="text-2xl font-semibold text-[var(--brand-yellow)]">70+</p>
              <p>Database Tables</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--brand-yellow)]">20</p>
              <p>Modules</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--brand-yellow)]">137</p>
              <p>API Endpoints</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-sidebar-muted">
          Bank of Tanzania TANQR Standard · TIPS Aligned · Letshego Faidika Bank
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden">
            <BrandLogo variant="compact" showTagline={false} />
            <p className="mt-2 text-xs text-muted-foreground">
              Merchant Management System
            </p>
          </div>

          <Card className="border-border shadow-[var(--shadow-lg)]">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <CardTitle>
                  {mode === 'login'
                    ? 'Sign in to your account'
                    : mode === 'forgot'
                      ? 'Forgot password'
                      : 'Reset password'}
                </CardTitle>
              </div>
              <CardDescription>
                {mode === 'login'
                  ? 'Secure access for acquirer staff and authorized personnel'
                  : mode === 'forgot'
                    ? 'Request a password reset token for this account'
                    : 'Set a new password using your reset token'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {success && <Alert variant="success">{success}</Alert>}
              {devResetToken && mode === 'reset' && (
                <Alert variant="warning">
                  Dev reset token:{' '}
                  <code className="break-all font-mono text-xs">
                    {devResetToken}
                  </code>
                </Alert>
              )}

              {mode === 'login' && (
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          setMode('forgot');
                          setError(null);
                          setSuccess(null);
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
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
              )}

              {mode === 'forgot' && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email address</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@bank.co.tz"
                    />
                  </div>
                  {error && <Alert variant="error">{error}</Alert>}
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={submitting}>
                      {submitting ? 'Sending…' : 'Send reset link'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                        setSuccess(null);
                      }}
                    >
                      Back
                    </Button>
                  </div>
                </form>
              )}

              {mode === 'reset' && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-token">Reset token</Label>
                    <Input
                      id="reset-token"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste reset token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      required
                      minLength={12}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 12 characters"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      required
                      minLength={12}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                    />
                  </div>
                  {error && <Alert variant="error">{error}</Alert>}
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={submitting}>
                      {submitting ? 'Resetting…' : 'Reset password'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                        setSuccess(null);
                      }}
                    >
                      Back
                    </Button>
                  </div>
                </form>
              )}
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
