import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, refreshTokens, setAuthState } from '../lib/api';
import {
  clearTokens,
  loadTokens,
  saveTokens,
} from '../lib/auth-storage';
import type {
  AuthResponse,
  LoginBody,
  RegisterBody,
  UserPublic,
} from '../lib/api-types';

/**
 * Authentication context — single source of truth for "who is signed in".
 *
 * What it owns:
 *  - `user`   — the current `UserPublic` (or `null` when signed out)
 *  - `status` — `"booting" | "anonymous" | "authenticated"`
 *               so screens can show the right thing during the initial
 *               token-bootstrap (no flash of unauthenticated content).
 *
 * It also kicks off a background timer that refreshes the access token a
 * little before it expires, so the rest of the app never has to think about
 * it — the next API call just succeeds.
 */
export type AuthStatus = 'booting' | 'anonymous' | 'authenticated';

export interface AuthContextValue {
  user: UserPublic | null;
  status: AuthStatus;
  login: (body: LoginBody) => Promise<UserPublic>;
  register: (body: RegisterBody) => Promise<UserPublic>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: 'booting',
  login: async () => { throw new Error('AuthProvider missing'); },
  register: async () => { throw new Error('AuthProvider missing'); },
  logout: async () => { throw new Error('AuthProvider missing'); },
});

interface AuthProviderProps {
  children: ReactNode;
}

/** How long before access-token expiry should we proactively refresh? */
const REFRESH_LEEWAY_MS = 60_000;

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [status, setStatus] = useState<AuthStatus>('booting');
  const queryClient = useQueryClient();

  // Timer handle so we don't double-schedule refreshes on token rotation.
  const refreshTimer = useRef<number | null>(null);

  // ---------------------------------------------------------------------
  // Persistence + side effects on tokens changing
  // ---------------------------------------------------------------------

  const scheduleProactiveRefresh = useCallback((expiresAt: number) => {
    if (refreshTimer.current !== null) {
      window.clearTimeout(refreshTimer.current);
    }
    const delay = Math.max(5_000, expiresAt - Date.now() - REFRESH_LEEWAY_MS);
    refreshTimer.current = window.setTimeout(async () => {
      const refreshed = await refreshTokens();
      if (refreshed) {
        scheduleProactiveRefresh(refreshed.expiresAt);
      } else {
        // Refresh failed → the API client already cleared the in-memory
        // tokens; mirror that into React state.
        setUser(null);
        setStatus('anonymous');
      }
    }, delay) as unknown as number;
  }, []);

  const adopt = useCallback(
    (auth: AuthResponse) => {
      const stored = saveTokens(auth.tokens);
      setAuthState(stored);
      setUser(auth.user);
      setStatus('authenticated');
      scheduleProactiveRefresh(stored.expiresAt);
    },
    [scheduleProactiveRefresh],
  );

  // ---------------------------------------------------------------------
  // Bootstrap: do we have stored tokens? Try to fetch /users/me.
  // ---------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = loadTokens();
      if (!stored) {
        if (!cancelled) setStatus('anonymous');
        return;
      }
      setAuthState(stored);

      try {
        const me = await api.get<UserPublic>('/users/me');
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
        scheduleProactiveRefresh(stored.expiresAt);
      } catch (err) {
        // Either token expired and refresh also failed, or backend's down.
        // Either way: treat as logged out and let the user re-login.
        if (cancelled) return;
        clearTokens();
        setAuthState(null);
        setUser(null);
        setStatus('anonymous');
        // Surface 5xx to the console so devs notice; 401 is expected.
        if (err instanceof ApiError && err.status >= 500) {
          console.warn('auth bootstrap failed', err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current);
      }
    };
  }, [scheduleProactiveRefresh]);

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  const login = useCallback(
    async (body: LoginBody) => {
      const auth = await api.post<AuthResponse>('/auth/login', body, {
        unauthenticated: true,
      });
      adopt(auth);
      return auth.user;
    },
    [adopt],
  );

  const register = useCallback(
    async (body: RegisterBody) => {
      const auth = await api.post<AuthResponse>('/auth/register', body, {
        unauthenticated: true,
      });
      adopt(auth);
      return auth.user;
    },
    [adopt],
  );

  const logout = useCallback(async () => {
    const stored = loadTokens();
    if (stored) {
      // Best-effort revoke server-side; don't block the UI on it.
      api
        .post('/auth/logout', { refresh_token: stored.refreshToken })
        .catch(() => {});
    }
    if (refreshTimer.current !== null) {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
    clearTokens();
    setAuthState(null);
    setUser(null);
    setStatus('anonymous');
    // Drop any cached per-user query results.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
