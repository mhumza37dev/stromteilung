import { QueryClient } from '@tanstack/react-query';
import { hydrateQueryClient, persistQueryClient } from './queryPersist';

/**
 * App-wide TanStack Query configuration.
 *
 * Defaults tuned for a snappy marketplace UI:
 *
 * - `staleTime: 30s`     → don't refetch on every screen revisit; rely on
 *                          mutations to invalidate the cache when something
 *                          really changed.
 * - `gcTime: 5min`       → keep results in cache across navigation so the
 *                          buyer dashboard re-paints instantly from cache,
 *                          then revalidates in the background (no flicker).
 * - `retry: 1`           → one quick retry on transient errors, then surface
 *                          to the user. Auth (401) is never retried.
 * - `refetchOnWindow…`   → off; we'd rather show stable data than re-fetch
 *                          every time the user tabs back.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // Don't retry 401/403/404 — they're definitive.
        if (
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          [401, 403, 404].includes((error as { status: number }).status)
        ) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Restore the last persisted cache *before* any component mounts, so a
// returning user's dashboard paints from storage on first render instead of
// flashing a skeleton. Then keep persisting on every cache change.
hydrateQueryClient(queryClient);
persistQueryClient(queryClient);
