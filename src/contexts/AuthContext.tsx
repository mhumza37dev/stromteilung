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
  loadUser,
  saveTokens,
  saveUser,
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
  /** GDPR account deletion — soft-deletes server-side, then clears the session. */
  deleteAccount: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: 'booting',
  login: async () => { throw new Error('AuthProvider missing'); },
  register: async () => { throw new Error('AuthProvider missing'); },
  logout: async () => { throw new Error('AuthProvider missing'); },
  deleteAccount: async () => { throw new Error('AuthProvider missing'); },
});

interface AuthProviderProps {
  children: ReactNode;
}

/** How long before access-token expiry should we proactively refresh? */
const REFRESH_LEEWAY_MS = 60_000;

export function AuthProvider({ children }: AuthProviderProps) {
  // Seed straight from storage so a returning user renders the authenticated
  // UI on the first paint — no blank "booting" frame. The bootstrap effect
  // below still revalidates the session against the backend and downgrades to
  // anonymous if the stored token turns out to be invalid.
  const [user, setUser] = useState<UserPublic | null>(() => loadUser());
  const [status, setStatus] = useState<AuthStatus>(() =>
    loadTokens() && loadUser() ? 'authenticated' : 'booting',
  );
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
      saveUser(auth.user);
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
        saveUser(me);
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

  // Tear down all local session state. Shared by logout and account deletion
  // so both converge to the exact same signed-out condition.
  const clearSession = useCallback(() => {
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

  const logout = useCallback(async () => {
    const stored = loadTokens();
    if (stored) {
      // Best-effort revoke server-side; don't block the UI on it.
      api
        .post('/auth/logout', { refresh_token: stored.refreshToken })
        .catch(() => {});
    }
    clearSession();
  }, [clearSession]);

  const deleteAccount = useCallback(async () => {
    // Await this one (unlike logout's fire-and-forget) so the account is
    // actually soft-deleted server-side before we drop the session — otherwise
    // we'd report success on a no-op. If it fails, we rethrow and leave the
    // session intact so the UI can surface the error rather than silently
    // signing the user out of a still-live account.
    await api.delete('/users/me');
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, status, login, register, logout, deleteAccount }),
    [user, status, login, register, logout, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
