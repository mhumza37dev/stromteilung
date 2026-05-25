import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { NearbySellersResponse } from '../../lib/api-types';

export interface NearbyParams {
  /** Latitude of the buyer's reference point. */
  lat: number | null;
  /** Longitude of the buyer's reference point. */
  lng: number | null;
  /** Radius in metres — defaults to the GRO regulation's 500 m. */
  radiusM?: number;
  /** Restrict to sellers on the same transformer as the buyer's profile. */
  requireSameTransformer?: boolean;
  /** Disable the query (e.g. while we don't yet have lat/lng resolved). */
  enabled?: boolean;
}

/**
 * Fetch sellers near a point. Returns `keepPreviousData` so filter changes
 * (city switches, radius tweaks) don't blank the grid — the previous list
 * stays visible until the new one arrives, then swaps cleanly.
 */
export function useNearbySellers(params: NearbyParams) {
  const {
    lat,
    lng,
    radiusM = 500,
    requireSameTransformer = false,
    enabled = true,
  } = params;

  return useQuery<NearbySellersResponse>({
    queryKey: ['sellers', 'nearby', { lat, lng, radiusM, requireSameTransformer }],
    enabled: enabled && lat !== null && lng !== null,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => {
      const search = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius_m: String(radiusM),
        require_same_transformer: String(requireSameTransformer),
      });
      return api.get<NearbySellersResponse>(
        `/sellers/nearby?${search.toString()}`,
        signal,
      );
    },
  });
}
