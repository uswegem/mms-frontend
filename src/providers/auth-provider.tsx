'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  decodeJwt,
  JwtClaims,
  login as apiLogin,
  logout as apiLogout,
  refreshSession,
  TokenResponse,
} from '@/lib/auth-api';
import { getMyPermissions } from '@/lib/authz-api';

const TOKEN_KEY = 'mms_access_token';

interface AuthContextValue {
  accessToken: string | null;
  user: JwtClaims | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    mfaCode?: string,
  ) => Promise<TokenResponse>;
  logout: () => Promise<void>;
  setSession: (token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [livePermissions, setLivePermissions] = useState<JwtClaims | null>(null);

  const setSession = useCallback((token: string) => {
    setAccessToken(token);
    sessionStorage.setItem(TOKEN_KEY, token);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    sessionStorage.removeItem(TOKEN_KEY);
  }, []);

  useEffect(() => {
    async function restore() {
      const stored = sessionStorage.getItem(TOKEN_KEY);
      if (stored) {
        const claims = decodeJwt(stored);
        if (claims && claims.exp * 1000 > Date.now()) {
          setAccessToken(stored);
          setIsLoading(false);
          return;
        }
      }
      try {
        const refreshed = await refreshSession();
        setSession(refreshed.accessToken);
      } catch {
        clearSession();
      } finally {
        setIsLoading(false);
      }
    }
    restore();
  }, [setSession, clearSession]);

  const login = useCallback(
    async (email: string, password: string, mfaCode?: string) => {
      const result = await apiLogin(email, password, mfaCode);
      setSession(result.accessToken);
      return result;
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    if (accessToken) {
      try {
        await apiLogout(accessToken);
      } catch {
        // clear local session even if API fails
      }
    }
    clearSession();
  }, [accessToken, clearSession]);

  useEffect(() => {
    if (!accessToken) {
      setLivePermissions(null);
      return;
    }
    getMyPermissions(accessToken)
      .then((effective) => {
        const claims = decodeJwt(accessToken);
        if (!claims) return;
        setLivePermissions({
          ...claims,
          roles: effective.roles,
          permissions: effective.permissions,
          storeIds: effective.storeIds,
          terminalIds: effective.terminalIds,
        });
      })
      .catch(() => {
        setLivePermissions(null);
      });
  }, [accessToken]);

  const user = useMemo(
    () => livePermissions ?? (accessToken ? decodeJwt(accessToken) : null),
    [accessToken, livePermissions],
  );

  const value = useMemo(
    () => ({
      accessToken,
      user,
      isAuthenticated: !!accessToken && !!user,
      isLoading,
      login,
      logout,
      setSession,
    }),
    [accessToken, user, isLoading, login, logout, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
