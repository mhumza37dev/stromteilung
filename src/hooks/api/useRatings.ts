import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
import type {
  RatingCreateBody,
  RatingPublic,
  RatingsAggregate,
} from '../../lib/api-types';

const RECEIVED_KEY = ['ratings', 'received'] as const;

export function useMyReceivedRatings() {
  return useQuery<RatingsAggregate>({
    queryKey: RECEIVED_KEY,
    queryFn: ({ signal }) => api.get<RatingsAggregate>('/ratings/received', signal),
  });
}

/** Submit a rating; refreshes the buyer's nearby query so the average updates. */
export function useCreateRating() {
  const queryClient = useQueryClient();
  return useMutation<RatingPublic, Error, RatingCreateBody>({
    mutationFn: (body) => api.post<RatingPublic>('/ratings', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers', 'nearby'] });
      queryClient.invalidateQueries({ queryKey: RECEIVED_KEY });
    },
  });
}
