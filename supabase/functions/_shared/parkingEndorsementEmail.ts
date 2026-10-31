/**
 * Phase 5 — endorsement automation. Auto-sends the moment a parking payment succeeds
 * (see `parkingPaymentOrchestrator.ts#fulfillParkingPayment`), addressed to the matching
 * development's PMO email with the guest CC'd, mirroring how the legacy property-attached
 * parking flow addresses its manual endorsement send. Distinct from `sendParkingConfirmedEmail`
 * (`parkingBroadcastEmail.ts`), which is the guest-facing "you're confirmed" notice.
 */

import { loadDevelopmentPmoEmailByName } from './developmentSerialize.ts';
import { createServiceClient, type ParkingRow } from './orgAuth.ts';
import {
  parkingLocationLabel,
  resolveParkingEmailBranding,
  sendResendEmail,
} from './parkingBroadcastEmail.ts';
import {
  assertParkingGuestOwnership,
  ParkingGuestOwnershipError,
} from './parkingGuestOwnership.ts';
import { formatEmailDateRange } from './propertyEmailBranding.ts';
import { renderPropertyTemplateSendEmail } from './propertyTemplateEmail.ts';
import { escapeHtml } from './renderEmailHtml.ts';

const ENDORSEMENT_BODY_TEMPLATE = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">This confirms <strong>{{guest_name}}</strong>'s parking reservation at <strong>{{parking_location}}</strong> for {{check_in_date}} to {{check_out_date}}.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">Please endorse the guest's vehicle for entry during this period.</p>`;

export class ParkingEndorsementRecipientError extends Error {}

export type SendParkingEndorsementEmailInput = {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  checkInDate: string;
  checkOutDate: string;
  parking: Pick<
    ParkingRow,
    'name' | 'organization_id' | 'residence_name' | 'tower' | 'level' | 'slot_label'
  >;
};

/**
 * Sends the endorsement email, then guarded-updates `guest_submissions.endorsement_sent_at` +
 * `endorsement_email_snapshot` on success (never overwritten if already set — first send wins).
 * On failure, records `endorsement_send_error` (only if not already sent) and rethrows so the
 * caller decides how to isolate the failure from the rest of its own flow.
 */
export async function sendParkingEndorsementEmail(
  input: SendParkingEndorsementEmailInput
): Promise<void> {
  const supabase = createServiceClient();

  try {
    const residenceName = input.parking.residence_name?.trim() ?? '';
    const pmoEmail = residenceName
      ? await loadDevelopmentPmoEmailByName(supabase, residenceName)
      : null;
    if (!pmoEmail) {
      throw new ParkingEndorsementRecipientError(
        residenceName
          ? `No PMO email configured for development "${residenceName}"`
          : 'Parking has no residence/development set — cannot resolve a PMO email'
      );
    }

    const { brandingPropertyId, settings, branding } = await resolveParkingEmailBranding(
      input.parking.organization_id
    );
    const parkingLocation = parkingLocationLabel(input.parking);

    const html = await renderPropertyTemplateSendEmail({
      propertyId: brandingPropertyId,
      templateKey: 'email-booking-acknowledgement',
      emailTitle: 'Parking Endorsement',
      contentOverride: ENDORSEMENT_BODY_TEMPLATE,
      branding,
      placeholderVars: {
        guest_name: escapeHtml(input.guestName),
        parking_location: escapeHtml(parkingLocation),
        tower_and_unit_number: escapeHtml(parkingLocation),
        check_in_date: escapeHtml(input.checkInDate),
        check_out_date: escapeHtml(input.checkOutDate),
      },
    });

    await sendResendEmail({
      fromDisplayName: branding.organizationName,
      fromEmail: branding.fromEmail,
      to: pmoEmail,
      cc: input.guestEmail ? [input.guestEmail] : undefined,
      replyTo: settings.emailReplyTo,
      subject: `${branding.organizationName} - Parking Endorsement ${formatEmailDateRange(input.checkInDate, input.checkOutDate)}`,
      html,
      errorLabel: 'parking endorsement email',
    });

    await supabase
      .from('guest_submissions')
      .update({
        endorsement_sent_at: new Date().toISOString(),
        endorsement_email_snapshot: html,
        endorsement_send_error: null,
      })
      .eq('id', input.bookingId)
      .is('endorsement_sent_at', null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('guest_submissions')
      .update({ endorsement_send_error: message })
      .eq('id', input.bookingId)
      .is('endorsement_sent_at', null);
    throw err;
  }
}

export class ParkingEndorsementRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const POST_PAYMENT_STATUSES = ['PENDING_REVIEW', 'READY_FOR_CHECKIN', 'COMPLETED'];

/** Guest-triggered resend — mirrors the ownership-check pattern in `parkingCancellation.ts`. */
export async function requestParkingEndorsementResend(
  bookingId: string,
  userId: string,
  userEmail?: string | null
): Promise<{ sent: boolean }> {
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from('guest_submissions')
    .select(
      'id, status, guest_auth_user_id, guest_email, primary_guest_name, parking_id, parking_check_in_date, parking_check_out_date, check_in_date, check_out_date, endorsement_sent_at'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) throw new ParkingEndorsementRequestError('Booking not found', 404);
  try {
    await assertParkingGuestOwnership(supabase, booking, { id: userId, email: userEmail });
  } catch (err) {
    if (err instanceof ParkingGuestOwnershipError) {
      throw new ParkingEndorsementRequestError(err.message, err.status);
    }
    throw err;
  }
  if (!POST_PAYMENT_STATUSES.includes(String(booking.status))) {
    throw new ParkingEndorsementRequestError('Payment has not been confirmed yet', 409);
  }
  if (booking.endorsement_sent_at) {
    throw new ParkingEndorsementRequestError('Endorsement has already been sent', 409);
  }

  const { data: parkingRow } = await supabase
    .from('parkings')
    .select('*')
    .eq('id', String(booking.parking_id ?? ''))
    .maybeSingle();
  if (!parkingRow) throw new ParkingEndorsementRequestError('Parking not found', 404);

  await sendParkingEndorsementEmail({
    bookingId,
    guestName: String(booking.primary_guest_name ?? ''),
    guestEmail: String(booking.guest_email ?? ''),
    checkInDate: String(booking.parking_check_in_date ?? booking.check_in_date ?? ''),
    checkOutDate: String(booking.parking_check_out_date ?? booking.check_out_date ?? ''),
    parking: parkingRow as ParkingRow,
  });

  return { sent: true };
}
