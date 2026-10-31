import { shouldWarnPastBookingStayForProceed } from '@/features/dashboard/bookings/lib/bookingPastPipelineManila';
import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import {
  workflowTransitionEmailEffects,
  type WorkflowEmailDevControlKey,
  type WorkflowEmailEffect,
  type WorkflowTransitionEffectsInput,
} from '@/features/dashboard/bookings/lib/workflowTransitionEffectsCopy';

export type { WorkflowEmailDevControlKey, WorkflowEmailEffect };

export type WorkflowEmailDevControls = Partial<Record<WorkflowEmailDevControlKey, boolean>>;

const EARLY_PIPELINE_STATUSES = new Set<BookingStatus>([
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
]);

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function hasDocumentCompletionMap(map: BookingRow['document_requirement_completions']): boolean {
  if (!map || typeof map !== 'object') return false;
  return Object.values(map).some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const row = entry as { completedAt?: string | null; approvedPdfUrl?: string | null };
    return hasText(row.completedAt) || hasText(row.approvedPdfUrl);
  });
}

/**
 * True when the row still carries artifacts from a later pipeline step — e.g. after
 * admin "Return to …" or a guest-field revert.
 */
export function bookingWasRegressedInPipeline(
  fromStatus: BookingStatus,
  booking: Pick<
    BookingRow,
    | 'gaf_request_pdf_url'
    | 'pet_request_pdf_url'
    | 'approved_gaf_pdf_url'
    | 'approved_pet_pdf_url'
    | 'gaf_completed_at'
    | 'pet_completed_at'
    | 'parking_completed_at'
    | 'document_requirement_completions'
    | 'stay_guide_token'
    | 'sd_refund_form_emailed_at'
    | 'sd_refund_form_submitted_at'
    | 'guest_balance_paid_amount'
  >
): boolean {
  const hasEarlyDocArtifacts =
    hasText(booking.gaf_request_pdf_url) ||
    hasText(booking.pet_request_pdf_url) ||
    hasText(booking.approved_gaf_pdf_url) ||
    hasText(booking.approved_pet_pdf_url) ||
    hasText(booking.gaf_completed_at) ||
    hasText(booking.pet_completed_at) ||
    hasText(booking.parking_completed_at) ||
    hasDocumentCompletionMap(booking.document_requirement_completions) ||
    hasText(booking.stay_guide_token);

  if (EARLY_PIPELINE_STATUSES.has(fromStatus) && hasEarlyDocArtifacts) {
    return true;
  }

  if (
    fromStatus === 'READY_FOR_CHECKIN' &&
    (hasText(booking.sd_refund_form_emailed_at) ||
      booking.guest_balance_paid_amount != null ||
      hasText(booking.sd_refund_form_submitted_at))
  ) {
    return true;
  }

  if (fromStatus === 'READY_FOR_CHECKOUT' && hasText(booking.sd_refund_form_submitted_at)) {
    return true;
  }

  return false;
}

export function shouldOfferWorkflowEmailChoices(
  input: WorkflowTransitionEffectsInput & { fromStatus: BookingStatus; booking: BookingRow }
): boolean {
  if (input.direction !== 'forward') return false;

  const emailEffects = workflowTransitionEmailEffects(input);
  if (emailEffects.length === 0) return false;

  return (
    shouldWarnPastBookingStayForProceed(input.fromStatus, input.booking) ||
    bookingWasRegressedInPipeline(input.fromStatus, input.booking)
  );
}

export function defaultWorkflowEmailChoiceState(
  effects: WorkflowEmailEffect[]
): Record<WorkflowEmailDevControlKey, boolean> {
  const state = {} as Record<WorkflowEmailDevControlKey, boolean>;
  for (const effect of effects) {
    state[effect.key] = false;
  }
  return state;
}

export function buildWorkflowEmailDevControls(
  effects: WorkflowEmailEffect[],
  checked: Partial<Record<WorkflowEmailDevControlKey, boolean>>
): WorkflowEmailDevControls {
  const devControls: WorkflowEmailDevControls = {};
  for (const effect of effects) {
    devControls[effect.key] = checked[effect.key] === true;
  }
  return devControls;
}
