/**
 * useRescheduleBooking — move a booking's stay dates from the booking detail
 * `⋯` → **Reschedule** action, then force the status back to the documents stage.
 *
 * Unlike the sensitive-guest-field revert in `useUpdateBooking` (which lands on
 * `PENDING_REVIEW` and runs through the orchestrator on the next Proceed), a
 * reschedule is a deliberate, host-confirmed reset: the modal makes the status
 * change mandatory, so this hook writes it through `update-booking-details`.
 * It always resets to **Pending Review** so the host re-runs the
 * pricing + document proceed from the top of the pipeline after a date move
 * (see `bookingPipeline`).
 *
 * This is a non-orchestrator status write — the same sanctioned exception as the
 * guest-edit revert paths (`.cursor/rules/booking-workflow.mdc` §6). It clears
 * nested doc completion, approved GAF/pet PDFs, parking + guest-balance
 * settlement (`pendingDocumentsClearPatchForGuestEditRevert` +
 * `pendingDocumentsClearCompletionsJsonbPatch`) but does **not** regenerate the
 * GAF/pet request PDFs or send the acknowledgement email — the host re-sends
 * those from **Automation Triggers** on the Progress rail if the new dates need
 * fresh paperwork.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { BOOKING_QUERY_KEY } from './useBooking';
import { invalidateBookingAiReviewQueries } from './useBookingAiReview';
import { invalidateBookingsListForProperty } from './useBookings';
import { callUpdateBookingDetails } from '../lib/updateBookingDetailsApi';

import type { BookingRow } from '../lib/types';

type MutationArgs = {
  bookingId: string;
  /** `YYYY-MM-DD` — new stay boundaries picked in the reschedule calendar. */
  checkInDate: string;
  checkOutDate: string;
  /**
   * Row's current `document_requirement_completions` value (from the loaded
   * booking) so the reset merges the gaf/pet clear into the JSONB map instead
   * of dropping unrelated requirement ids.
   */
  currentDocumentRequirementCompletions?: unknown;
};

export function useRescheduleBooking() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async ({
      bookingId,
      checkInDate,
      checkOutDate,
      currentDocumentRequirementCompletions,
    }: MutationArgs) => {
      const { booking } = await callUpdateBookingDetails(propertyId, {
        operation: 'reschedule',
        bookingId,
        checkInDate,
        checkOutDate,
        currentDocumentRequirementCompletions,
      });
      return booking as BookingRow;
    },

    onSuccess: async (updated, { bookingId }) => {
      qc.setQueryData(BOOKING_QUERY_KEY(bookingId), updated);
      await invalidateBookingsListForProperty(qc, propertyId);
      await invalidateBookingAiReviewQueries(qc, bookingId);
    },
  });
}
