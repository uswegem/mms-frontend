'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
/** Refresh this many ms before access-token expiry. */
const REFRESH_SKEW_MS = 60_000;

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
  /** Refresh access token using the httpOnly refresh cookie. */
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [livePermissions, setLivePermissions] = useState<JwtClaims | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const setSession = useCallback((token: string) => {
    setAccessToken(token);
    sessionStorage.setItem(TOKEN_KEY, token);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    sessionStorage.removeItem(TOKEN_KEY);
    setLivePermissions(null);
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    refreshInFlight.current = (async () => {
      try {
        const refreshed = await refreshSession();
        setSession(refreshed.accessToken);
        return refreshed.accessToken;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();

    return refreshInFlight.current;
  }, [setSession, clearSession]);

  useEffect(() => {
    async function restore() {
      const stored = sessionStorage.getItem(TOKEN_KEY);
      if (stored) {
        const claims = decodeJwt(stored);
        const stillUsable =
          claims && claims.exp * 1000 - Date.now() > REFRESH_SKEW_MS;
        if (stillUsable) {
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
    void restore();
  }, [setSession, clearSession]);

  // Keep React state in sync when API helpers refresh the token.
  useEffect(() => {
    function onTokenRefreshed(event: Event) {
      const token = (event as CustomEvent<string>).detail;
      if (token) setSession(token);
    }
    window.addEventListener('mms:token-refreshed', onTokenRefreshed);
    return () => window.removeEventListener('mms:token-refreshed', onTokenRefreshed);
  }, [setSession]);

  // Proactively refresh before the 15m access token expires.
  useEffect(() => {
    if (!accessToken) return;
    const claims = decodeJwt(accessToken);
    if (!claims?.exp) return;

    const msUntilRefresh = claims.exp * 1000 - Date.now() - REFRESH_SKEW_MS;
    if (msUntilRefresh <= 0) {
      void refreshAccessToken();
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshAccessToken();
    }, msUntilRefresh);

    return () => window.clearTimeout(timer);
  }, [accessToken, refreshAccessToken]);

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
      .catch(async (err) => {
        const message = err instanceof Error ? err.message : '';
        if (message.toLowerCase().includes('unauthorized') || message.includes('401')) {
          await refreshAccessToken();
          return;
        }
        setLivePermissions(null);
      });
  }, [accessToken, refreshAccessToken]);

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
      refreshAccessToken,
    }),
    [accessToken, user, isLoading, login, logout, setSession, refreshAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
