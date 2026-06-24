'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';

export function useRequireAuth() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.replace('/login');
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  return auth;
}
