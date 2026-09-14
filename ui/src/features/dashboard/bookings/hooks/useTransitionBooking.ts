import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { SdBank } from '@/features/guest/sd-form/lib/sdFormSchema';

import {
  BOOKING_QUERY_KEY,
  bookingDetailQueryKey,
} from '@/features/dashboard/bookings/hooks/useBooking';
import {
  invalidateBookingsListForProperty,
  patchBookingsListRow,
} from '@/features/dashboard/bookings/hooks/useBookings';
import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { BookingWorkflowEmailKind } from '@/features/dashboard/bookings/lib/bookingWorkflowEmail';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import {
  notifyAutomationSkippedByHost,
  notifyAutomationSkippedByPlan,
} from '@/features/dashboard/bookings/lib/workflowPlanSkip';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

export {
  AUTOMATION_SKIP_LABELS,
  AUTOMATION_SKIP_SESSION_KEY,
  notifyAutomationSkippedByPlan,
} from '@/features/dashboard/bookings/lib/workflowPlanSkip';

export type TransitionPayload = {
  booking_rate?: number | null;
  down_payment?: number | null;
  security_deposit?: number | null;
  pet_fee?: number | null;
  parking_rate_guest?: number | null;
  guest_additional_fee?: number | null;
  applied_voucher_discount_php?: number | null;
  surprise_decor_staff_acknowledged?: boolean;
  parking_rate_paid?: number | null;
  parking_owner_email?: string | null;
  parking_owner?: string | null;
  parking_endorsement_url?: string | null;
  parking_fee_included_in_downpayment?: boolean | null;
  parking_payment_receipt_url?: string | null;
  sd_additional_expense_items?: Array<{ label: string; amount: number }> | null;
  sd_additional_profit_items?: Array<{ label: string; amount: number }> | null;
  sd_additional_expenses?: number[] | null;
  sd_additional_profits?: number[] | null;
  sd_refund_amount?: number | null;
  sd_refund_receipt_url?: string | null;
  guest_balance_paid_amount?: number | null;
  guest_balance_payment_receipt_url?: string | null;
  sd_refund_guest_feedback?: string | null;
  sd_refund_method?: 'same_phone' | 'other_bank' | 'cash' | null;
  sd_refund_phone_confirmed?: boolean | null;
  sd_refund_bank?: SdBank | null;
  sd_refund_account_name?: string | null;
  sd_refund_account_number?: string | null;
  approved_gaf_pdf_url?: string | null;
  approved_pet_pdf_url?: string | null;
  /**
   * Legacy `PENDING_GAF` / `PENDING_PARKING_REQUEST` / `PENDING_PET_REQUEST`
   * literals, or a bare configurable-requirement id (e.g. `"gaf"`, a custom
   * id) — mirrors `workflowOrchestrator.ts` §`LEGACY_DOC_TARGET_TO_REQUIREMENT_ID`.
   */
  document_completion_target?: string | null;
};

/** Mirrors `_shared/workflowOrchestrator.ts#DevControlFlags` email keys. */
export type TransitionEmailDevControls = {
  sendGafRequestEmail?: boolean;
  sendBookingAcknowledgementEmail?: boolean;
  sendPetRequestEmail?: boolean;
  sendParkingBroadcastEmail?: boolean;
  sendReadyForCheckinEmail?: boolean;
  sendSdRefundFormEmail?: boolean;
};

type TransitionInput = {
  bookingId: string;
  toStatus: BookingStatus;
  payload?: TransitionPayload;
  devControls?: TransitionEmailDevControls;
  manual?: boolean;
};

type TransitionResult = {
  success: boolean;
  booking: BookingRow;
  sideEffects?: {
    emails?: string[];
    automationSkippedByPlan?: string[];
    automationSkippedByHost?: string[];
  };
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

async function callTransitionBooking(input: TransitionInput, propertyId: string | null) {
  const jwt = await getAdminJwt();

  const res = await fetch(scopedFunctionsUrl('/transition-booking', propertyId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      bookingId: input.bookingId,
      toStatus: input.toStatus,
      payload: input.payload ?? {},
      ...(input.devControls ? { devControls: input.devControls } : {}),
      manual: input.manual ?? true,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }

  return json.data as TransitionResult;
}

/**
 * Mutation hook for booking transitions.
 * On success, merges the returned booking row (incl. stay_guide_token) then invalidates caches.
 */
export function useTransitionBooking() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: (input: TransitionInput) => callTransitionBooking(input, propertyId),
    onMutate: async (variables) => {
      const detailKey = bookingDetailQueryKey(variables.bookingId, propertyId);
      await qc.cancelQueries({ queryKey: detailKey });

      const previousDetail = qc.getQueryData<BookingRow | null>(detailKey);
      if (previousDetail) {
        qc.setQueryData(detailKey, { ...previousDetail, status: variables.toStatus });
      }
      patchBookingsListRow(qc, propertyId, variables.bookingId, { status: variables.toStatus });

      return { previousDetail };
    },
    onError: (_err, variables, context) => {
      if (context?.previousDetail) {
        qc.setQueryData(
          bookingDetailQueryKey(variables.bookingId, propertyId),
          context.previousDetail
        );
        patchBookingsListRow(qc, propertyId, variables.bookingId, {
          status: context.previousDetail.status,
        });
      }
    },
    onSuccess: async (data, variables) => {
      // Write session hint before cache updates so Automation Triggers can expand
      // when Free-plan skips land and eligible Send kinds appear on the new status.
      notifyAutomationSkippedByPlan(
        data?.sideEffects?.automationSkippedByPlan ?? [],
        variables.bookingId
      );
      notifyAutomationSkippedByHost(data?.sideEffects?.automationSkippedByHost ?? []);
      if (data?.booking) {
        qc.setQueryData(bookingDetailQueryKey(variables.bookingId, propertyId), data.booking);
      }
      await qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(variables.bookingId) });
      await invalidateBookingsListForProperty(qc, propertyId);
    },
  });
}

/**
 * Mutation hook for cancelling a booking (calls cancel-booking function).
 */
export function useCancelBooking() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async ({ bookingId }: { bookingId: string }) => {
      const jwt = await getAdminJwt();

      const res = await fetch(scopedFunctionsUrl('/cancel-booking', propertyId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ bookingId, confirm: true }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json;
    },
    onSuccess: async (_data, variables) => {
      await qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(variables.bookingId) });
      await invalidateBookingsListForProperty(qc, propertyId);
    },
  });
}

// ─── Manual automation triggers (Q6.6) ───────────────────────────────────────
// These invoke the same scheduled edge functions that Supabase cron calls,
// but triggered manually by an admin when automation is late or stuck.

type RunAutomationResult = {
  success: boolean;
  applied?: number;
  skipped?: number;
  failed?: number;
  transitioned?: number;
  scanned?: number;
  /** True when `sd-refund-cron` was called with `{ bookingId }` (admin detail only). */
  scoped?: boolean;
  transitionedSdEmailSent?: number;
  transitionedSdEmailSuppressed?: number;
  /** Cron sent check-out email while booking stayed READY_FOR_CHECKIN (awaiting settlement). */
  checkoutEmailsSent?: number;
  initialized?: boolean;
  historyReset?: boolean;
  [key: string]: unknown;
};

/**
 * Manually trigger the SD refund cron (Phase 4 — Q6.6).
 * When `bookingId` is set, POSTs `{ bookingId }` so only that row is evaluated (same rules as scheduled cron).
 * Invalidates the booking detail so status updates show immediately.
 */
export function useRunSdRefundCron(bookingId?: string) {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (): Promise<RunAutomationResult> => {
      const jwt = await getAdminJwt();

      const res = await fetch(scopedFunctionsUrl('/sd-refund-cron', propertyId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          ...(bookingId ? { 'Content-Type': 'application/json' } : {}),
        },
        body: bookingId ? JSON.stringify({ bookingId }) : undefined,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json as RunAutomationResult;
    },
    onSuccess: async () => {
      if (!bookingId) return;
      await qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(bookingId) });
      await invalidateBookingsListForProperty(qc, propertyId);
    },
  });
}

/**
 * Re-send the guest Check-out & SD Refund Details email (Ready for Check-out).
 */
export function useResendSdRefundFormEmail(bookingId?: string) {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (): Promise<{
      success: boolean;
      skipped?: boolean;
      reason?: string;
    }> => {
      if (!bookingId) throw new Error('bookingId is required');
      const jwt = await getAdminJwt();

      const res = await fetch(scopedFunctionsUrl('/send-sd-refund-form-email', propertyId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ bookingId }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json;
    },
    onSuccess: async () => {
      if (!bookingId) return;
      await qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(bookingId) });
      await invalidateBookingsListForProperty(qc, propertyId);
    },
  });
}

/**
 * Manual (re-)send of a plan-gated workflow email via `send-booking-workflow-email`.
 */
export function useSendBookingWorkflowEmail(bookingId?: string) {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (
      kind: BookingWorkflowEmailKind
    ): Promise<{
      success: boolean;
      kind: BookingWorkflowEmailKind;
    }> => {
      if (!bookingId) throw new Error('bookingId is required');
      const jwt = await getAdminJwt();

      const res = await fetch(scopedFunctionsUrl('/send-booking-workflow-email', propertyId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ bookingId, kind }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json as { success: boolean; kind: BookingWorkflowEmailKind };
    },
    onSuccess: async () => {
      if (!bookingId) return;
      await qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(bookingId) });
      await invalidateBookingsListForProperty(qc, propertyId);
    },
  });
}

/** Create or refresh the guest stay guide link (RFCI+ bookings). */
export function useIssueGuestStayGuideToken(bookingId?: string) {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (): Promise<{
      success: boolean;
      data?: {
        stayGuideUrl: string;
        stayGuideToken: string;
        validUntil: string;
      };
    }> => {
      if (!bookingId) throw new Error('bookingId is required');
      const jwt = await getAdminJwt();

      const res = await fetch(scopedFunctionsUrl('/issue-guest-stay-guide-token', propertyId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ bookingId }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json;
    },
    onSuccess: async (result) => {
      if (!bookingId || !result.data) return;
      qc.setQueryData(
        bookingDetailQueryKey(bookingId, propertyId),
        (prev: BookingRow | null | undefined) => {
          if (!prev) return prev;
          return {
            ...prev,
            stay_guide_token: result.data!.stayGuideToken,
            stay_guide_valid_until: result.data!.validUntil,
          };
        }
      );
      await qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(bookingId) });
      await invalidateBookingsListForProperty(qc, propertyId);
    },
  });
}

/**
 * Mint (or rotate) the guest-form completion link for an OTA-ingested booking
 * (calendar sync Phase 2, §6.5). Returns `{ completionUrl, guestFormToken }`.
 */
export function useIssueGuestFormCompletionToken(bookingId?: string) {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (): Promise<{
      success: boolean;
      data?: { completionUrl: string; guestFormToken: string };
    }> => {
      if (!bookingId) throw new Error('bookingId is required');
      const jwt = await getAdminJwt();
      const res = await fetch(
        scopedFunctionsUrl('/issue-guest-form-completion-token', propertyId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ bookingId }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json;
    },
    onSuccess: async (result) => {
      if (!bookingId || !result.data) return;
      qc.setQueryData(
        bookingDetailQueryKey(bookingId, propertyId),
        (prev: BookingRow | null | undefined) =>
          prev ? { ...prev, guest_form_token: result.data!.guestFormToken } : prev
      );
      await qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(bookingId) });
    },
  });
}

/** Create or reuse the durable share token for a booking's approved GAF/Pet PDFs. */
export function useIssueBookingDocumentShareToken(bookingId?: string) {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (): Promise<{
      success: boolean;
      data?: { documentShareToken: string };
    }> => {
      if (!bookingId) throw new Error('bookingId is required');
      const jwt = await getAdminJwt();

      const res = await fetch(
        scopedFunctionsUrl('/issue-booking-document-share-token', propertyId),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ bookingId }),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json;
    },
    onSuccess: async (result) => {
      if (!bookingId || !result.data) return;
      qc.setQueryData(
        bookingDetailQueryKey(bookingId, propertyId),
        (prev: BookingRow | null | undefined) => {
          if (!prev) return prev;
          return { ...prev, document_share_token: result.data!.documentShareToken };
        }
      );
      await qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(bookingId) });
    },
  });
}
