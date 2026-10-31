/** Kinds for `send-booking-workflow-email` — mirror `_shared/sendBookingWorkflowEmail.ts`. */

export const BOOKING_WORKFLOW_EMAIL_KINDS = [
  'gaf_request',
  'pet_request',
  'booking_acknowledgement',
  'ready_for_checkin',
  'sd_refund_form_request',
] as const;

export type BookingWorkflowEmailKind = (typeof BOOKING_WORKFLOW_EMAIL_KINDS)[number];

export const BOOKING_WORKFLOW_EMAIL_LABELS: Record<BookingWorkflowEmailKind, string> = {
  gaf_request: 'GAF request',
  pet_request: 'Pet request',
  booking_acknowledgement: 'Booking acknowledgement',
  ready_for_checkin: 'Ready for check-in',
  sd_refund_form_request: 'Check-out Instructions',
};

/** Display order in Automation Triggers (acknowledgement first — guest-facing). */
export const MANUAL_WORKFLOW_EMAIL_TRIGGER_ORDER: BookingWorkflowEmailKind[] = [
  'booking_acknowledgement',
  'gaf_request',
  'pet_request',
  'ready_for_checkin',
  'sd_refund_form_request',
];

export function sortManualWorkflowEmailTriggerKinds(
  kinds: BookingWorkflowEmailKind[]
): BookingWorkflowEmailKind[] {
  const rank = new Map(MANUAL_WORKFLOW_EMAIL_TRIGGER_ORDER.map((kind, index) => [kind, index]));
  return [...kinds].sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99));
}

export type BookingForManualWorkflowEmail = {
  status: string;
  has_pets?: boolean | string | null;
  need_parking?: boolean | string | null;
  gaf_request_pdf_url?: string | null;
  pet_request_pdf_url?: string | null;
  valid_id_url?: string | null;
  guest2_name?: string | null;
  guest2_valid_id_url?: string | null;
  guest3_name?: string | null;
  guest3_valid_id_url?: string | null;
  guest4_name?: string | null;
  guest4_valid_id_url?: string | null;
  guest5_name?: string | null;
  guest5_valid_id_url?: string | null;
  pet_vaccination_url?: string | null;
  pet_image_url?: string | null;
  workflow_email_manual_sent_at?: Record<string, string> | null;
  sd_refund_form_emailed_at?: string | null;
};

function flagTrue(v: unknown): boolean {
  return v === true || v === 'true';
}

function hasUrl(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * Which manual workflow emails are eligible for this booking’s current status.
 * Shown on Free (escape hatch) and paid (resend) alike.
 */
export function eligibleManualWorkflowEmailKinds(
  booking: BookingForManualWorkflowEmail
): BookingWorkflowEmailKind[] {
  const status = booking.status;
  if (status === 'CANCELLED' || status === 'COMPLETED') return [];

  const kinds: BookingWorkflowEmailKind[] = [];

  const afterReview =
    status !== 'PENDING_REVIEW' &&
    (status === 'PENDING_DOCUMENTS' ||
      status === 'PENDING_GAF' ||
      status === 'PENDING_PARKING_REQUEST' ||
      status === 'PENDING_PET_REQUEST' ||
      status === 'READY_FOR_CHECKIN' ||
      status === 'READY_FOR_CHECKOUT' ||
      status === 'PENDING_SD_REFUND');

  if (afterReview) {
    if (hasUrl(booking.gaf_request_pdf_url)) kinds.push('gaf_request');
    if (flagTrue(booking.has_pets) && hasUrl(booking.pet_request_pdf_url)) {
      kinds.push('pet_request');
    }
    kinds.push('booking_acknowledgement');
  }

  if (status === 'READY_FOR_CHECKIN') {
    kinds.push('ready_for_checkin');
    kinds.push('sd_refund_form_request');
  }

  if (status === 'READY_FOR_CHECKOUT') {
    kinds.push('sd_refund_form_request');
  }

  return kinds;
}
