import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { NearbySellersResponse } from '../../lib/api-types';

export interface NearbyParams {
  /**
   * Latitude of the buyer's reference point. Pass `null` to let the backend
   * fall back to the buyer's saved profile geo (the common case).
   */
  lat: number | null;
  /**
   * Longitude of the buyer's reference point. Pass `null` to let the backend
   * fall back to the buyer's saved profile geo.
   */
  lng: number | null;
  /** Radius in metres — defaults to the GRO regulation's 500 m. */
  radiusM?: number;
  /** Restrict to sellers on the same transformer as the buyer's profile. */
  requireSameTransformer?: boolean;
  /** Disable the query (e.g. while we don't yet have a profile loaded). */
  enabled?: boolean;
}

/**
 * Fetch sellers near a point. Returns `keepPreviousData` so filter changes
 * (city switches, radius tweaks) don't blank the grid — the previous list
 * stays visible until the new one arrives, then swaps cleanly.
 *
 * When both `lat` and `lng` are `null` we omit them entirely and let the
 * backend resolve the buyer's profile geo server-side.
 */
export function useNearbySellers(params: NearbyParams) {
  const {
    lat,
    lng,
    radiusM = 1500,
    requireSameTransformer = false,
    enabled = true,
  } = params;

  return useQuery<NearbySellersResponse>({
    queryKey: ['sellers', 'nearby', { lat, lng, radiusM, requireSameTransformer }],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => {
      const search = new URLSearchParams({
        radius_m: String(radiusM),
        require_same_transformer: String(requireSameTransformer),
      });
      if (lat !== null && lng !== null) {
        search.set('lat', String(lat));
        search.set('lng', String(lng));
      }
      return api.get<NearbySellersResponse>(
        `/sellers/nearby?${search.toString()}`,
        signal,
      );
    },
  });
}
