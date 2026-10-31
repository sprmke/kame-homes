/**
 * Parking broadcast/claim emails — per-recipient Resend sends (never BCC blast).
 * Branding borrows the org's first property, mirroring `parkingTeamInviteEmail.ts`.
 */

import { resolveAppSettings } from './appSettings.ts';
import { resolveEmailOnPrimaryHex, resolveEmailPrimaryHex } from './emailBrandColor.ts';
import { createServiceClient, type ParkingRow } from './orgAuth.ts';
import {
  formatEmailDateRange,
  formatResendFromAddress,
  loadPropertyEmailBranding,
} from './propertyEmailBranding.ts';
import { renderPropertyTemplateSendEmail } from './propertyTemplateEmail.ts';
import { escapeHtml } from './renderEmailHtml.ts';

async function getFirstPropertyIdForOrg(organizationId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function getOrgSlug(organizationId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', organizationId)
    .maybeSingle();
  return (data?.slug as string | undefined) ?? null;
}

export function parkingLocationLabel(
  parking: Pick<ParkingRow, 'name' | 'residence_name' | 'tower' | 'level' | 'slot_label'>
): string {
  const parts = [parking.name.trim()];
  if (parking.residence_name?.trim()) parts.push(parking.residence_name.trim());
  if (parking.tower?.trim()) parts.push(parking.tower.trim());
  if (parking.level?.trim()) parts.push(`Level ${parking.level.trim()}`);
  if (parking.slot_label?.trim()) parts.push(`Slot ${parking.slot_label.trim()}`);
  return parts.filter(Boolean).join(' - ');
}

function requireResendKey(): string {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('Missing RESEND_API_KEY');
  return key;
}

export async function resolveParkingEmailBranding(organizationId: string) {
  const brandingPropertyId = await getFirstPropertyIdForOrg(organizationId);
  if (!brandingPropertyId) {
    throw new Error('No property available for email branding in this organization');
  }
  const [settings, branding] = await Promise.all([
    resolveAppSettings(brandingPropertyId),
    loadPropertyEmailBranding(brandingPropertyId),
  ]);
  return { brandingPropertyId, settings, branding };
}

export async function sendResendEmail(input: {
  fromDisplayName: string;
  fromEmail: string;
  to: string;
  cc?: string[];
  replyTo: string;
  subject: string;
  html: string;
  errorLabel: string;
}): Promise<void> {
  const RESEND_API_KEY = requireResendKey();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: formatResendFromAddress(input.fromDisplayName, input.fromEmail),
      to: [input.to],
      ...(input.cc && input.cc.length > 0 ? { cc: input.cc } : {}),
      reply_to: input.replyTo,
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Failed to send ${input.errorLabel} (${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`
    );
  }
}

const HOST_REQUEST_BODY_TEMPLATE = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">A guest is requesting <strong>{{parking_location}}</strong> for {{check_in_date}} to {{check_out_date}}.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">Guest: <strong>{{guest_name}}</strong></p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">This request expires at {{expires_at}}. First host to accept gets the booking.</p>
<p>{{view_request_cta}}</p>`;

const GUEST_CONFIRMED_BODY_TEMPLATE = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">Your parking request for <strong>{{parking_location}}</strong> ({{check_in_date}} to {{check_out_date}}) has been accepted.</p>
{{endorsement_block}}`;

const GUEST_AWAITING_PAYMENT_BODY_TEMPLATE = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">A host accepted your parking request for <strong>{{parking_location}}</strong> ({{check_in_date}} to {{check_out_date}}). Pay before {{expires_at}} to confirm your reservation.</p>
<p>{{pay_now_cta}}</p>`;

const GUEST_NO_HOST_BODY_TEMPLATE = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">No host was available to accept your parking request for {{check_in_date}} to {{check_out_date}}. Please try another listing or contact us for help.</p>`;

function buildCtaHtml(url: string, label: string, brandColor: string): string {
  if (!url.trim()) return '';
  const fill = resolveEmailPrimaryHex(brandColor);
  const onFill = resolveEmailOnPrimaryHex(brandColor);
  return `<div style="margin:28px 0 8px 0;text-align:center;"><a style="display:inline-block;padding:12px 24px;border-radius:8px;background:${fill};color:${onFill};text-decoration:none;font-weight:600;" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></div>`;
}

function formatExpiresAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

export type ParkingReservationRequestEmailInput = {
  to: string;
  parking: Pick<
    ParkingRow,
    'id' | 'name' | 'organization_id' | 'residence_name' | 'tower' | 'level' | 'slot_label' | 'slug'
  >;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  expiresAtIso: string;
  bookingId: string;
};

/** Host notify — sent once per eligible recipient, not a BCC blast. */
export async function sendParkingReservationRequestEmail(
  input: ParkingReservationRequestEmailInput
): Promise<void> {
  const { brandingPropertyId, settings, branding } = await resolveParkingEmailBranding(
    input.parking.organization_id
  );
  const orgSlug = await getOrgSlug(input.parking.organization_id);
  const parkingLocation = parkingLocationLabel(input.parking);

  const viewUrl =
    orgSlug && input.parking.slug
      ? `${settings.publicGuestAppOrigin.replace(/\/+$/, '')}/org/${orgSlug}/parking/${input.parking.slug}/bookings/${input.bookingId}`
      : '';

  const html = await renderPropertyTemplateSendEmail({
    propertyId: brandingPropertyId,
    templateKey: 'email-booking-acknowledgement',
    emailTitle: 'Parking Reservation Request',
    contentOverride: HOST_REQUEST_BODY_TEMPLATE,
    branding,
    placeholderVars: {
      parking_location: escapeHtml(parkingLocation),
      guest_name: escapeHtml(input.guestName),
      expires_at: escapeHtml(formatExpiresAt(input.expiresAtIso)),
      view_request_cta: buildCtaHtml(viewUrl, 'View Request', settings.brandColor),
      tower_and_unit_number: escapeHtml(parkingLocation),
      check_in_date: escapeHtml(input.checkInDate),
      check_out_date: escapeHtml(input.checkOutDate),
    },
  });

  await sendResendEmail({
    fromDisplayName: branding.organizationName,
    fromEmail: branding.fromEmail,
    to: input.to,
    replyTo: settings.emailReplyTo,
    subject: `${branding.organizationName} - New Parking Request ${formatEmailDateRange(input.checkInDate, input.checkOutDate)}`,
    html,
    errorLabel: 'parking reservation request email',
  });
}

export type ParkingConfirmedEmailInput = {
  to: string;
  parking: Pick<
    ParkingRow,
    'name' | 'organization_id' | 'residence_name' | 'tower' | 'level' | 'slot_label'
  >;
  checkInDate: string;
  checkOutDate: string;
  endorsementNote?: string | null;
};

/** Guest confirmation — sent once, on the winning claim. */
export async function sendParkingConfirmedEmail(input: ParkingConfirmedEmailInput): Promise<void> {
  const { brandingPropertyId, settings, branding } = await resolveParkingEmailBranding(
    input.parking.organization_id
  );
  const parkingLocation = parkingLocationLabel(input.parking);
  const note = input.endorsementNote?.trim();
  const endorsementBlock = note
    ? `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;"><strong>Access instructions:</strong> ${escapeHtml(note)}</p>`
    : '';

  const html = await renderPropertyTemplateSendEmail({
    propertyId: brandingPropertyId,
    templateKey: 'email-booking-acknowledgement',
    emailTitle: 'Parking Confirmed',
    contentOverride: GUEST_CONFIRMED_BODY_TEMPLATE,
    branding,
    placeholderVars: {
      parking_location: escapeHtml(parkingLocation),
      endorsement_block: endorsementBlock,
      tower_and_unit_number: escapeHtml(parkingLocation),
      check_in_date: escapeHtml(input.checkInDate),
      check_out_date: escapeHtml(input.checkOutDate),
    },
  });

  await sendResendEmail({
    fromDisplayName: branding.organizationName,
    fromEmail: branding.fromEmail,
    to: input.to,
    replyTo: settings.emailReplyTo,
    subject: `${branding.organizationName} - Parking Confirmed ${formatEmailDateRange(input.checkInDate, input.checkOutDate)}`,
    html,
    errorLabel: 'parking confirmed email',
  });
}

export type ParkingAwaitingPaymentEmailInput = {
  to: string;
  parking: Pick<
    ParkingRow,
    'name' | 'organization_id' | 'residence_name' | 'tower' | 'level' | 'slot_label'
  >;
  checkInDate: string;
  checkOutDate: string;
  expiresAtIso: string;
  bookingId: string;
};

/** Guest "host accepted, pay to confirm" nudge — sent once, on claim (Phase 3). */
export async function sendParkingAwaitingPaymentEmail(
  input: ParkingAwaitingPaymentEmailInput
): Promise<void> {
  const { brandingPropertyId, settings, branding } = await resolveParkingEmailBranding(
    input.parking.organization_id
  );
  const parkingLocation = parkingLocationLabel(input.parking);
  const payUrl = `${settings.publicGuestAppOrigin.replace(/\/+$/, '')}/parkings/requests/${input.bookingId}`;

  const html = await renderPropertyTemplateSendEmail({
    propertyId: brandingPropertyId,
    templateKey: 'email-booking-acknowledgement',
    emailTitle: 'Parking — Pay to Confirm',
    contentOverride: GUEST_AWAITING_PAYMENT_BODY_TEMPLATE,
    branding,
    placeholderVars: {
      parking_location: escapeHtml(parkingLocation),
      expires_at: escapeHtml(formatExpiresAt(input.expiresAtIso)),
      pay_now_cta: buildCtaHtml(payUrl, 'Pay Now', settings.brandColor),
      tower_and_unit_number: escapeHtml(parkingLocation),
      check_in_date: escapeHtml(input.checkInDate),
      check_out_date: escapeHtml(input.checkOutDate),
    },
  });

  await sendResendEmail({
    fromDisplayName: branding.organizationName,
    fromEmail: branding.fromEmail,
    to: input.to,
    replyTo: settings.emailReplyTo,
    subject: `${branding.organizationName} - Pay to Confirm Parking ${formatEmailDateRange(input.checkInDate, input.checkOutDate)}`,
    html,
    errorLabel: 'parking awaiting-payment email',
  });
}

export type ParkingNoHostAvailableEmailInput = {
  to: string;
  organizationId: string;
  checkInDate: string;
  checkOutDate: string;
};

/** Guest terminal notice — sent once, on all-decline or TTL expiry. */
export async function sendParkingNoHostAvailableEmail(
  input: ParkingNoHostAvailableEmailInput
): Promise<void> {
  const { brandingPropertyId, settings, branding } = await resolveParkingEmailBranding(
    input.organizationId
  );

  const html = await renderPropertyTemplateSendEmail({
    propertyId: brandingPropertyId,
    templateKey: 'email-booking-acknowledgement',
    emailTitle: 'Parking Unavailable',
    contentOverride: GUEST_NO_HOST_BODY_TEMPLATE,
    branding,
    placeholderVars: {
      tower_and_unit_number: escapeHtml(branding.unitLabel),
      check_in_date: escapeHtml(input.checkInDate),
      check_out_date: escapeHtml(input.checkOutDate),
    },
  });

  await sendResendEmail({
    fromDisplayName: branding.organizationName,
    fromEmail: branding.fromEmail,
    to: input.to,
    replyTo: settings.emailReplyTo,
    subject: `${branding.organizationName} - No Host Available ${formatEmailDateRange(input.checkInDate, input.checkOutDate)}`,
    html,
    errorLabel: 'parking no-host-available email',
  });
}
