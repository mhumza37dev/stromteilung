import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import type {
  ProfilePublic,
  ProfileUpsertBody,
} from '../../lib/api-types';

const MY_PROFILE_KEY = ['profile', 'mine'] as const;

/**
 * Read the current user's marketplace profile.
 *
 * Treats a 404 as "no profile yet" (returns `null`) instead of throwing —
 * the onboarding flow is the supported empty state and shouldn't pop a
 * scary error.
 */
export function useMyProfile() {
  return useQuery<ProfilePublic | null>({
    queryKey: MY_PROFILE_KEY,
    queryFn: async ({ signal }) => {
      try {
        return await api.get<ProfilePublic>('/users/me/profile', signal);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
  });
}

/** Create or replace the current user's profile. */
export function useUpsertMyProfile() {
  const queryClient = useQueryClient();
  return useMutation<ProfilePublic, Error, ProfileUpsertBody>({
    mutationFn: (body) => api.put<ProfilePublic>('/users/me/profile', body),
    onSuccess: (profile) => {
      queryClient.setQueryData(MY_PROFILE_KEY, profile);
      // Buyer's nearby query depends on profile geo — invalidate so it refetches.
      queryClient.invalidateQueries({ queryKey: ['sellers', 'nearby'] });
    },
  });
}
