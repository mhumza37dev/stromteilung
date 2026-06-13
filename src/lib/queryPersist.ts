/**
 * localStorage-backed persistence for the TanStack Query cache.
 *
 * Why: on a cold reload the dashboard used to start from an empty cache, so
 * every list re-fetched from scratch and the UI flashed skeleton → data. By
 * dehydrating successful queries into storage and hydrating them back before
 * the first render, a returning user sees their last-known data instantly,
 * then React Query revalidates in the background once it goes stale (no
 * flicker, because the data is already present so `isPending` is false).
 *
 * Trade-off: cached read results (profile, nearby sellers) sit in
 * localStorage in plaintext — the same origin-readable surface the auth
 * tokens already accept (see `auth-storage.ts`). Acceptable for the MVP;
 * nothing secret is cached. The cache is cleared on logout via
 * `queryClient.clear()`, whose cache event triggers a save of the now-empty
 * state.
 *
 * Uses the built-in `dehydrate`/`hydrate` so we don't pull in the separate
 * `@tanstack/react-query-persist-client` package.
 */
import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient,
} from '@tanstack/react-query';

const STORAGE_KEY = 'stromteilung.qcache.v1';

/** Drop persisted cache older than this — stale data past a day isn't worth showing. */
const MAX_AGE_MS = 24 * 60 * 60_000;

/** Coalesce bursts of cache events into a single write. */
const SAVE_DEBOUNCE_MS = 1_000;

interface Persisted {
  savedAt: number;
  state: DehydratedState;
}

/**
 * Restore a previously persisted cache into `client`. Call this once, before
 * the app renders, so the first paint already has data.
 */
export function hydrateQueryClient(client: QueryClient): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const { savedAt, state } = JSON.parse(raw) as Persisted;
    if (!savedAt || Date.now() - savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    hydrate(client, state);
  } catch {
    // Corrupt / unparseable / storage disabled — start from an empty cache.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — nothing to clean up */
    }
  }
}

/**
 * Subscribe to the cache and persist successful queries to localStorage on
 * every change (debounced). Returns an unsubscribe function.
 */
export function persistQueryClient(client: QueryClient): () => void {
  let timer: number | null = null;

  const flush = () => {
    timer = null;
    try {
      const state = dehydrate(client, {
        // Only persist completed reads; in-flight / errored queries would
        // hydrate into a confusing state on the next load.
        shouldDehydrateQuery: (query) => query.state.status === 'success',
      });
      const payload: Persisted = { savedAt: Date.now(), state };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota exceeded / serialization failure — persistence is best-effort.
    }
  };

  const schedule = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(flush, SAVE_DEBOUNCE_MS) as unknown as number;
  };

  const unsubscribe = client.getQueryCache().subscribe(schedule);

  return () => {
    if (timer !== null) window.clearTimeout(timer);
    unsubscribe();
  };
}
