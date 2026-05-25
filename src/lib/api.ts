/**
 * Typed fetch client for the Stromteilung backend.
 *
 * Responsibilities:
 *
 * 1. Prefix every request with `VITE_API_URL`.
 * 2. Attach the current access token automatically.
 * 3. Refresh the token transparently when it expires (or a 401 indicates so),
 *    then replay the original request once.
 * 4. Surface backend error shapes (`{ code, message, details }`) as a typed
 *    `ApiError` so React Query / UI code can match on `code`.
 *
 * Auth state lives in this module via simple closures — `AuthContext` calls
 * `setAuthState` on login/logout so every fetch sees the latest tokens
 * without a re-render dance.
 */
import {
  clearTokens,
  loadTokens,
  saveTokens,
  type StoredTokens,
} from './auth-storage';
import type { ApiProblem, TokenPair } from './api-types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8000/api/v1';

/** Refresh the access token this many ms before its declared expiry. */
const REFRESH_LEEWAY_MS = 30_000;

// ---------------------------------------------------------------------------
// Token state — mutable closures, single source of truth
// ---------------------------------------------------------------------------

let tokens: StoredTokens | null = loadTokens();

/** Called by AuthContext after login / refresh / logout. */
export function setAuthState(next: StoredTokens | null): void {
  tokens = next;
}

export function getAuthState(): StoredTokens | null {
  return tokens;
}

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, problem: ApiProblem) {
    super(problem.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = problem.code;
    this.details = problem.details ?? {};
  }
}

// ---------------------------------------------------------------------------
// Refresh flow
// ---------------------------------------------------------------------------

/**
 * In-flight refresh promise so 17 concurrent requests don't all trigger 17
 * refreshes — they all await this same promise instead.
 */
let inflightRefresh: Promise<StoredTokens | null> | null = null;

async function refreshTokens(): Promise<StoredTokens | null> {
  if (!tokens?.refreshToken) return null;
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokens!.refreshToken }),
      });
      if (!response.ok) {
        // Refresh failed → user is effectively signed out.
        clearTokens();
        tokens = null;
        return null;
      }
      const pair = (await response.json()) as TokenPair;
      tokens = saveTokens(pair);
      return tokens;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

function isAccessExpiringSoon(): boolean {
  if (!tokens) return false;
  return tokens.expiresAt - Date.now() < REFRESH_LEEWAY_MS;
}

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip auth header — used by /auth/login, /auth/register, /auth/refresh. */
  unauthenticated?: boolean;
  signal?: AbortSignal;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  // Pro-actively refresh before sending if expiry is close.
  if (!options.unauthenticated && tokens && isAccessExpiringSoon()) {
    await refreshTokens();
  }

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!options.unauthenticated && tokens) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const doFetch = () =>
    fetch(`${BASE_URL}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

  let response = await doFetch();

  // Single retry after refresh on 401 (the proactive refresh above misses
  // when the server clock differs from ours).
  if (response.status === 401 && !options.unauthenticated && tokens) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      headers.Authorization = `Bearer ${refreshed.accessToken}`;
      response = await doFetch();
    }
  }

  if (response.status === 204) {
    // No body — return undefined cast to T for `void` endpoints.
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const problem =
      data && typeof data === 'object' && 'code' in data
        ? (data as ApiProblem)
        : { code: 'unknown', message: response.statusText };
    throw new ApiError(response.status, problem);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Typed verb helpers (used by the React Query hooks)
// ---------------------------------------------------------------------------

export const api = {
  get:    <T>(path: string, signal?: AbortSignal)         => request<T>(path, { method: 'GET', signal }),
  post:   <T>(path: string, body?: unknown, opts?: { unauthenticated?: boolean }) =>
    request<T>(path, { method: 'POST', body: body ?? {}, unauthenticated: opts?.unauthenticated }),
  patch:  <T>(path: string, body: unknown)                => request<T>(path, { method: 'PATCH', body }),
  put:    <T>(path: string, body: unknown)                => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string)                               => request<T>(path, { method: 'DELETE' }),
};

export { refreshTokens };
