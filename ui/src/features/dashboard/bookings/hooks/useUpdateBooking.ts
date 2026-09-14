/**
 * useUpdateBooking — mutation to patch guest_submissions directly via Supabase.
 *
 * Used by BookingEditForm. All writes go through the authenticated admin session.
 * When `revertToPendingReview` is true and `currentStatus` is in the documents pipeline
 * or Ready for check-in (see `shouldRevertGuestFieldEditsToPendingReview` in
 * `bookingStatus.ts`), this also resets status → PENDING_REVIEW and merges
 * `pendingDocumentsClearPatchForGuestEditRevert` (nested doc completion, approved
 * PDF URLs, parking settlement, guest balance settlement — **not** pricing snapshot
 * fields or request PDF URLs unless PDF fill fields changed) plus
 * `pendingDocumentsClearCompletionsJsonbPatch` (gaf/pet reset merged into the
 * `document_requirement_completions` JSONB map so the dual-read stepper doesn't show
 * a stale "complete" substep). The caller must pass the currently-loaded row's
 * `document_requirement_completions` via `currentDocumentRequirementCompletions`.
 * When workflow-sensitive guest fields changed, `BookingEditSaveChoiceDialog` lets
 * the admin choose revert vs save-only before calling this hook.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { SdBank } from '@/features/guest/sd-form/lib/sdFormSchema';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';
import { toGuestSubmissionDate, toGuestSubmissionTime } from '@/utils/format/dates';


import { BOOKING_QUERY_KEY } from './useBooking';
import { invalidateBookingAiReviewQueries } from './useBookingAiReview';
import { invalidateBookingsListForProperty } from './useBookings';
import {
  pendingDocumentsClearCompletionsJsonbPatch,
  pendingDocumentsClearPatchForGuestEditRevert,
  shouldRevertGuestFieldEditsToPendingReview,
} from '../lib/bookingStatus';
import { requestPdfClearPatchForAdminGuestEdit } from '../lib/workflowSensitiveGuestDiff';

import type { DocumentRequirement } from '../lib/documentRequirements';
import type { BookingRow } from '../lib/types';

function patchGuestSubmissionForDb(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  if (typeof out.check_in_date === 'string' && out.check_in_date) {
    out.check_in_date = toGuestSubmissionDate(out.check_in_date);
  }
  if (typeof out.check_out_date === 'string' && out.check_out_date) {
    out.check_out_date = toGuestSubmissionDate(out.check_out_date);
  }
  if (typeof out.check_in_time === 'string' && out.check_in_time) {
    out.check_in_time = toGuestSubmissionTime(out.check_in_time);
  }
  if (typeof out.check_out_time === 'string' && out.check_out_time) {
    out.check_out_time = toGuestSubmissionTime(out.check_out_time);
  }
  return out;
}

function computeBalance(bookingRate?: number | null, downPayment?: number | null): number | null {
  if (bookingRate == null || downPayment == null) return null;
  return Math.round((bookingRate - downPayment) * 100) / 100;
}

export type UpdateBookingPayload = {
  // Guest identity
  guest_facebook_name?: string;
  primary_guest_name?: string;
  guest_email?: string;
  guest_phone_number?: string;
  guest_address?: string | null;
  nationality?: string | null;

  // Additional guests
  primary_guest_age?: number | null;
  guest2_name?: string | null;
  guest2_age?: number | null;
  guest3_name?: string | null;
  guest3_age?: number | null;
  guest4_name?: string | null;
  guest4_age?: number | null;
  guest5_name?: string | null;
  guest5_age?: number | null;

  // Stay details
  check_in_date?: string;
  check_out_date?: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  number_of_adults?: number;
  number_of_children?: number | null;
  number_of_nights?: number;

  // Parking
  need_parking?: boolean;
  car_plate_number?: string | null;
  car_brand_model?: string | null;
  car_color?: string | null;

  // Pets
  has_pets?: boolean;
  pet_name?: string | null;
  pet_type?: string | null;
  pet_breed?: string | null;
  pet_age?: string | null;
  pet_vaccination_date?: string | null;

  // Other
  booking_source?: string;
  find_us?: string | null;
  find_us_details?: string | null;
  guest_special_requests?: string | null;
  guest_requests_surprise_decor?: boolean;

  // Progress / workflow fields (rail Save + transitions)
  booking_rate?: number;
  down_payment?: number;
  balance?: number | null;
  security_deposit?: number;
  pet_fee?: number;
  parking_rate_guest?: number;
  guest_additional_fee?: number;
  surprise_decor_staff_acknowledged?: boolean;
  parking_owner?: string | null;
  parking_rate_paid?: number;
  parking_endorsement_url?: string | null;
  parking_fee_included_in_downpayment?: boolean;
  parking_payment_receipt_url?: string | null;
  parking_receipt_ai_verdict?: string | null;
  parking_receipt_ai_summary?: string | null;
  guest_balance_paid_amount?: number | null;
  guest_balance_payment_receipt_url?: string | null;
  balance_receipt_ai_verdict?: string | null;
  balance_receipt_ai_summary?: string | null;
  sd_additional_expense_items?: Array<{ label: string; amount: number }>;
  sd_additional_profit_items?: Array<{ label: string; amount: number }>;
  sd_additional_expenses?: number[];
  sd_additional_profits?: number[];
  sd_refund_amount?: number;
  sd_refund_receipt_url?: string | null;
  sd_refund_method?: 'same_phone' | 'other_bank' | 'cash';
  sd_refund_phone_confirmed?: boolean | null;
  sd_refund_bank?: SdBank | null;
  sd_refund_account_name?: string | null;
  sd_refund_account_number?: string | null;
  sd_refund_guest_feedback?: string | null;
};

type MutationArgs = {
  bookingId: string;
  /** Row status at submit time — used to gate status reset. */
  currentStatus: string;
  payload: UpdateBookingPayload;
  /** When true (and current status allows), also resets status to PENDING_REVIEW. */
  revertToPendingReview?: boolean;
  /**
   * Row's current `document_requirement_completions` value (from the loaded
   * booking) — required so the revert patch can merge the gaf/pet reset into
   * the JSONB map instead of dropping unrelated ids. Only read when
   * `revertToPendingReview` ends up applying.
   */
  currentDocumentRequirementCompletions?: unknown;
  /**
   * Baseline payload before the edit — used to clear request PDF URLs only when
   * PDF fill fields changed. Required when `revertToPendingReview` may apply.
   */
  revertBaselinePayload?: UpdateBookingPayload;
  documentRequirements?: DocumentRequirement[];
};

export function useUpdateBooking() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async ({
      bookingId,
      currentStatus,
      payload,
      revertToPendingReview,
      currentDocumentRequirementCompletions,
      revertBaselinePayload,
      documentRequirements,
    }: MutationArgs) => {
      let patch: Record<string, unknown> = {
        ...payload,
        updated_at: new Date().toISOString(),
      };

      if (payload.booking_source === 'Airbnb') {
        patch.down_payment = 0;
        patch.security_deposit = 0;
      }

      if (
        payload.booking_rate != null &&
        (payload.down_payment != null || payload.booking_source === 'Airbnb') &&
        payload.balance === undefined
      ) {
        patch.balance = computeBalance(
          payload.booking_rate,
          payload.booking_source === 'Airbnb' ? 0 : payload.down_payment
        );
      }

      patch = patchGuestSubmissionForDb(patch);

      if (revertToPendingReview && shouldRevertGuestFieldEditsToPendingReview(currentStatus)) {
        Object.assign(patch, pendingDocumentsClearPatchForGuestEditRevert());
        if (revertBaselinePayload) {
          Object.assign(
            patch,
            requestPdfClearPatchForAdminGuestEdit(
              revertBaselinePayload,
              payload,
              documentRequirements
            )
          );
        }
        patch.document_requirement_completions = pendingDocumentsClearCompletionsJsonbPatch(
          currentDocumentRequirementCompletions
        );
        patch.status = 'PENDING_REVIEW';
        patch.status_updated_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('guest_submissions')
        .update(patch)
        .eq('id', bookingId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as BookingRow;
    },

    onSuccess: async (updated, { bookingId }) => {
      qc.setQueryData(BOOKING_QUERY_KEY(bookingId), updated);
      await invalidateBookingsListForProperty(qc, propertyId);
      await invalidateBookingAiReviewQueries(qc, bookingId);
    },
  });
}
