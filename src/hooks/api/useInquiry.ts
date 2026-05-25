import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type {
  InquiryCreateBody,
  InquiryPublic,
} from '../../lib/api-types';

/**
 * Record a buyer→seller contact (WhatsApp click).
 *
 * The backend dedupes within a 1-hour window per (buyer, seller) pair, so
 * calling this on every click is safe and idempotent. We fire-and-forget
 * from the buyer dashboard so the click → WhatsApp navigation isn't slowed
 * down by the round-trip.
 */
export function useRecordInquiry() {
  return useMutation<InquiryPublic, Error, InquiryCreateBody>({
    mutationFn: (body) => api.post<InquiryPublic>('/inquiries', body),
  });
}
