/**
 * Manual (re-)send of booking workflow emails — escape hatch when automation is
 * skipped (Free plan / `automatedBookingFlow`) or failed. Always uses
 * `rawPropertyAutomationEnabled` (property toggle only — never the plan gate).
 *
 * Called from `send-booking-workflow-email` edge function.
 */

import { createClient } from './supabaseJs.ts';
import {
  sendBookingAcknowledgement,
  sendEmail,
  sendPetEmail,
  sendReadyForCheckin,
  sendSdRefundFormRequest,
} from './emailService.ts';
import { DatabaseService } from './databaseService.ts';
import { parseStorageUrl } from './receiptValidationService.ts';
import {
  rawPropertyAutomationEnabled,
  type PropertyAutomationToggleKey,
} from './propertyAutomationToggles.ts';
import type { GuestSubmission } from './types.ts';
import {
  gafRequestSendBlockReason,
  petRequestSendBlockReason,
} from './workflowEmailSendPrerequisites.ts';
import {
  formatWorkflowEmailResendWait,
  lastWorkflowEmailManualSentAt,
  mergeWorkflowEmailManualSentAt,
  parseWorkflowEmailManualSentAt,
  propertyHasAutomatedBookingFlow,
  workflowEmailManualCooldownRemainingMs,
} from './workflowEmailManualSendCooldown.ts';

export const BOOKING_WORKFLOW_EMAIL_KINDS = [
  'gaf_request',
  'pet_request',
  'booking_acknowledgement',
  'ready_for_checkin',
  'sd_refund_form_request',
] as const;

export type BookingWorkflowEmailKind = (typeof BOOKING_WORKFLOW_EMAIL_KINDS)[number];

const KIND_TO_TOGGLE: Record<BookingWorkflowEmailKind, PropertyAutomationToggleKey> = {
  gaf_request: 'emailGafRequest',
  pet_request: 'emailPetRequest',
  booking_acknowledgement: 'emailBookingAcknowledgement',
  ready_for_checkin: 'emailReadyForCheckin',
  sd_refund_form_request: 'emailSdRefundCheckout',
};

const TOGGLE_DISABLED_MESSAGE: Record<BookingWorkflowEmailKind, string> = {
  gaf_request: 'GAF request emails are disabled in property automations',
  pet_request: 'Pet request emails are disabled in property automations',
  booking_acknowledgement: 'Booking acknowledgement emails are disabled in property automations',
  ready_for_checkin: 'Ready-for-check-in emails are disabled in property automations',
  sd_refund_form_request: 'Check-out & SD refund emails are disabled in property automations',
};

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

async function downloadPdfBytes(url: string): Promise<Uint8Array | null> {
  const loc = parseStorageUrl(url);
  if (loc) {
    const { data, error } = await supabaseAdmin().storage.from(loc.bucket).download(loc.path);
    if (error || !data) {
      console.error('[sendBookingWorkflowEmail] storage download failed:', error?.message);
      return null;
    }
    return new Uint8Array(await data.arrayBuffer());
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.error('[sendBookingWorkflowEmail] fetch download failed:', err);
    return null;
  }
}

/** Mirrors `workflowOrchestrator.ts#buildGuestFormData` for emailService callers. */
function buildGuestFormData(booking: GuestSubmission): Record<string, unknown> {
  const b = booking as Record<string, unknown>;
  return {
    guestFacebookName: b.guest_facebook_name,
    primaryGuestName: b.primary_guest_name,
    primaryGuestAge: b.primary_guest_age,
    guestEmail: b.guest_email,
    guestPhoneNumber: b.guest_phone_number,
    guestAddress: b.guest_address,
    checkInDate: b.check_in_date,
    checkOutDate: b.check_out_date,
    checkInTime: b.check_in_time,
    checkOutTime: b.check_out_time,
    nationality: b.nationality,
    numberOfAdults: b.number_of_adults,
    numberOfChildren: b.number_of_children,
    numberOfNights: b.number_of_nights,
    guest2Name: b.guest2_name,
    guest2Age: b.guest2_age,
    guest3Name: b.guest3_name,
    guest3Age: b.guest3_age,
    guest4Name: b.guest4_name,
    guest4Age: b.guest4_age,
    guest5Name: b.guest5_name,
    guest5Age: b.guest5_age,
    guestSpecialRequests: b.guest_special_requests,
    findUs: b.find_us,
    findUsDetails: b.find_us_details,
    bookingSource: b.booking_source || 'Facebook',
    needParking: b.need_parking,
    carPlateNumber: b.car_plate_number,
    carBrandModel: b.car_brand_model,
    carColor: b.car_color,
    hasPets: b.has_pets,
    petName: b.pet_name,
    petType: b.pet_type,
    petBreed: b.pet_breed,
    petAge: b.pet_age,
    petVaccinationDate: b.pet_vaccination_date,
    petVaccinationUrl: b.pet_vaccination_url,
    petImageUrl: b.pet_image_url,
    paymentReceiptUrl: b.payment_receipt_url,
    validIdUrl: b.valid_id_url,
    guest2ValidIdUrl: b.guest2_valid_id_url,
    guest3ValidIdUrl: b.guest3_valid_id_url,
    guest4ValidIdUrl: b.guest4_valid_id_url,
    guest5ValidIdUrl: b.guest5_valid_id_url,
    unitOwner: b.unit_owner,
    towerAndUnitNumber: b.tower_and_unit_number,
    ownerOnsiteContactPerson: b.owner_onsite_contact_person,
    ownerContactNumber: b.owner_contact_number,
  };
}

function bookingFlagTrue(v: unknown): boolean {
  return v === true || v === 'true';
}

export function isBookingWorkflowEmailKind(value: unknown): value is BookingWorkflowEmailKind {
  return (
    typeof value === 'string' && (BOOKING_WORKFLOW_EMAIL_KINDS as readonly string[]).includes(value)
  );
}

export class SendBookingWorkflowEmailError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'SendBookingWorkflowEmailError';
    this.status = status;
  }
}

/**
 * Send one workflow email without changing booking status.
 * Throws `SendBookingWorkflowEmailError` for client-facing failures.
 */
export async function sendBookingWorkflowEmail(
  bookingId: string,
  propertyId: string,
  kind: BookingWorkflowEmailKind
): Promise<{ bookingId: string; kind: BookingWorkflowEmailKind }> {
  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) {
    throw new SendBookingWorkflowEmailError('Booking not found', 404);
  }

  const bookingPropertyId =
    typeof booking.property_id === 'string' ? booking.property_id.trim() : '';
  if (!bookingPropertyId || bookingPropertyId !== propertyId) {
    throw new SendBookingWorkflowEmailError('Booking does not belong to this property', 403);
  }

  const toggleKey = KIND_TO_TOGGLE[kind];
  const allowed = await rawPropertyAutomationEnabled(propertyId, toggleKey);
  if (!allowed) {
    throw new SendBookingWorkflowEmailError(TOGGLE_DISABLED_MESSAGE[kind], 409);
  }

  const sentMap = parseWorkflowEmailManualSentAt(
    (booking as Record<string, unknown>).workflow_email_manual_sent_at
  );
  const hasAutomatedFlow = await propertyHasAutomatedBookingFlow(propertyId);
  if (!hasAutomatedFlow) {
    const lastSent = lastWorkflowEmailManualSentAt(
      sentMap,
      kind,
      (booking as { sd_refund_form_emailed_at?: string | null }).sd_refund_form_emailed_at
    );
    const remainingMs = workflowEmailManualCooldownRemainingMs(lastSent);
    if (remainingMs > 0) {
      throw new SendBookingWorkflowEmailError(formatWorkflowEmailResendWait(remainingMs), 429);
    }
  }

  const status = String(booking.status ?? '');
  const sentAtIso = new Date().toISOString();

  switch (kind) {
    case 'gaf_request': {
      const pdfUrl = String(booking.gaf_request_pdf_url ?? '').trim();
      if (!pdfUrl) {
        throw new SendBookingWorkflowEmailError(
          'GAF request PDF is missing — proceed from Pending Review first'
        );
      }
      if (status === 'PENDING_REVIEW' || status === 'CANCELLED') {
        throw new SendBookingWorkflowEmailError(`Cannot send GAF request in status ${status}`);
      }
      const gafBlock = gafRequestSendBlockReason(booking);
      if (gafBlock) {
        throw new SendBookingWorkflowEmailError(gafBlock, 409);
      }
      const pdfBytes = await downloadPdfBytes(pdfUrl);
      if (!pdfBytes?.length) {
        throw new SendBookingWorkflowEmailError('Could not download GAF request PDF', 500);
      }
      await sendEmail(buildGuestFormData(booking) as never, pdfBytes, false, booking);
      break;
    }
    case 'pet_request': {
      if (!bookingFlagTrue(booking.has_pets)) {
        throw new SendBookingWorkflowEmailError('Booking does not include pets');
      }
      const pdfUrl = String(booking.pet_request_pdf_url ?? '').trim();
      if (!pdfUrl) {
        throw new SendBookingWorkflowEmailError(
          'Pet request PDF is missing — proceed from Pending Review first'
        );
      }
      if (status === 'PENDING_REVIEW' || status === 'CANCELLED') {
        throw new SendBookingWorkflowEmailError(`Cannot send pet request in status ${status}`);
      }
      const petBlock = petRequestSendBlockReason(booking);
      if (petBlock) {
        throw new SendBookingWorkflowEmailError(petBlock, 409);
      }
      const pdfBytes = await downloadPdfBytes(pdfUrl);
      if (!pdfBytes?.length) {
        throw new SendBookingWorkflowEmailError('Could not download pet request PDF', 500);
      }
      await sendPetEmail(
        buildGuestFormData(booking) as never,
        pdfBytes,
        booking.pet_image_url ?? undefined,
        booking.pet_vaccination_url ?? undefined,
        false,
        propertyId
      );
      break;
    }
    case 'booking_acknowledgement': {
      if (status === 'PENDING_REVIEW' || status === 'CANCELLED') {
        throw new SendBookingWorkflowEmailError(
          `Cannot send booking acknowledgement in status ${status}`
        );
      }
      await sendBookingAcknowledgement(booking);
      break;
    }
    case 'ready_for_checkin': {
      if (status !== 'READY_FOR_CHECKIN') {
        throw new SendBookingWorkflowEmailError(
          `Booking must be READY_FOR_CHECKIN (current: ${status})`
        );
      }
      await sendReadyForCheckin(booking);
      break;
    }
    case 'sd_refund_form_request': {
      if (status !== 'READY_FOR_CHECKOUT' && status !== 'READY_FOR_CHECKIN') {
        throw new SendBookingWorkflowEmailError(
          `Booking must be in READY_FOR_CHECKIN or READY_FOR_CHECKOUT (current: ${status})`
        );
      }
      await sendSdRefundFormRequest(booking);
      break;
    }
    default: {
      const _exhaustive: never = kind;
      throw new SendBookingWorkflowEmailError(`Unknown kind: ${_exhaustive}`);
    }
  }

  const stamp: Record<string, unknown> = {
    workflow_email_manual_sent_at: mergeWorkflowEmailManualSentAt(
      (booking as Record<string, unknown>).workflow_email_manual_sent_at,
      kind,
      sentAtIso
    ),
  };
  if (kind === 'sd_refund_form_request') {
    stamp.sd_refund_form_emailed_at = sentAtIso;
  }
  await DatabaseService.setWorkflowFields(bookingId, stamp);

  return { bookingId, kind };
}
