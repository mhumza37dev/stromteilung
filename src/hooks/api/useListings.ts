import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
import type {
  ListingCreateBody,
  ListingPublic,
  ListingUpdateBody,
} from '../../lib/api-types';

/** Cache key root for the authenticated seller's own listings. */
const MY_LISTINGS_KEY = ['listings', 'mine'] as const;

/** Read-side: list the current seller's listings. */
export function useMyListings() {
  return useQuery<ListingPublic[]>({
    queryKey: MY_LISTINGS_KEY,
    queryFn: ({ signal }) => api.get<ListingPublic[]>('/listings', signal),
  });
}

/** Optimistic create — the new listing flashes in immediately. */
export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation<ListingPublic, Error, ListingCreateBody>({
    mutationFn: (body) => api.post<ListingPublic>('/listings', body),
    onSuccess: (created) => {
      queryClient.setQueryData<ListingPublic[]>(
        MY_LISTINGS_KEY,
        (prev) => (prev ? [created, ...prev] : [created]),
      );
    },
  });
}

/** Update a single listing, optimistically. */
export function useUpdateListing() {
  const queryClient = useQueryClient();
  return useMutation<
    ListingPublic,
    Error,
    { id: string; body: ListingUpdateBody }
  >({
    mutationFn: ({ id, body }) =>
      api.patch<ListingPublic>(`/listings/${id}`, body),
    onSuccess: (updated) => {
      queryClient.setQueryData<ListingPublic[]>(MY_LISTINGS_KEY, (prev) =>
        prev?.map((l) => (l.id === updated.id ? updated : l)),
      );
    },
  });
}

/** Remove a listing, optimistically. */
export function useDeleteListing() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete<void>(`/listings/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: MY_LISTINGS_KEY });
      const previous =
        queryClient.getQueryData<ListingPublic[]>(MY_LISTINGS_KEY) ?? [];
      queryClient.setQueryData<ListingPublic[]>(MY_LISTINGS_KEY, (prev) =>
        prev?.filter((l) => l.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      // Roll back the optimistic removal on error.
      const ctx = context as { previous?: ListingPublic[] } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(MY_LISTINGS_KEY, ctx.previous);
      }
    },
  });
}
