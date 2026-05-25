/**
 * localStorage-backed token persistence.
 *
 * Trade-off: localStorage is readable by any JS on the origin, so an XSS
 * exploit could exfiltrate tokens. For a closed-source marketplace MVP this
 * is the standard tradeoff — once we host a real backend we'll move refresh
 * tokens into an httpOnly cookie and keep only the short-lived access token
 * in memory.
 *
 * Centralising the storage in one module means the migration to cookies is
 * a single-file change.
 */

const ACCESS_KEY = 'stromteilung.access_token';
const REFRESH_KEY = 'stromteilung.refresh_token';
const EXPIRES_AT_KEY = 'stromteilung.access_expires_at';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires; used for proactive refresh. */
  expiresAt: number;
}

export function loadTokens(): StoredTokens | null {
  try {
    const accessToken = localStorage.getItem(ACCESS_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    const raw = localStorage.getItem(EXPIRES_AT_KEY);
    if (!accessToken || !refreshToken || !raw) return null;
    const expiresAt = Number.parseInt(raw, 10);
    if (Number.isNaN(expiresAt)) return null;
    return { accessToken, refreshToken, expiresAt };
  } catch {
    // Private mode / disabled storage — behave as logged-out.
    return null;
  }
}

export function saveTokens(tokens: {
  access_token: string;
  refresh_token: string;
  /** Seconds until expiry (matches backend's `TokenPair.expires_in`). */
  expires_in: number;
}): StoredTokens {
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
  };
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}
