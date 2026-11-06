/**
 * useReviewBookingDocument — host rejection of an approved GAF / pet PDF.
 *
 * Calls `update-booking-details` (`operation: 'review_document'`), which clears
 * the file + completion for that requirement and records the rejection reason.
 * The edge handler rate-limits repeated reviews per booking + requirement.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';


import { BOOKING_QUERY_KEY } from './useBooking';
import { invalidateBookingAiReviewQueries } from './useBookingAiReview';
import { BOOKINGS_QUERY_KEY } from './useBookings';
import { callUpdateBookingDetails } from '../lib/updateBookingDetailsApi';

import type { DocRejectionReason } from '../lib/documentReview';

type RejectArgs = {
  bookingId: string;
  requirementId: string;
  assetType: 'approved_gaf' | 'approved_pet';
  reason: DocRejectionReason;
  note?: string | null;
};

export function useReviewBookingDocument() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async ({ bookingId, requirementId, assetType, reason, note }: RejectArgs) => {
      await callUpdateBookingDetails(propertyId, {
        operation: 'review_document',
        bookingId,
        requirementId,
        assetType,
        decision: 'reject',
        reason,
        ...(note?.trim() ? { note: note.trim() } : {}),
      });
    },
    onSuccess: async (_, { bookingId }) => {
      await qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(bookingId) });
      await qc.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      await invalidateBookingAiReviewQueries(qc, bookingId);
    },
  });
}
