/**
 * get-parking-booking-status — public narrow read for the guest status page.
 * The booking UUID in the URL is the bearer capability — do not add a list endpoint.
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolveOrgSettings } from '../_shared/orgSettings.ts';
import {
  DEFAULT_ORG_BRAND_COLOR,
  resolveOrgBrandColorFromSettings,
} from '../_shared/orgSettingsValidation.ts';
import { resolveParkingHostContact } from '../_shared/parkingBroadcast.ts';
import { loadResolvedBrandColorByParkingId } from '../_shared/parkingBranding.ts';
import { resolveParkingPlatformSettings } from '../_shared/parkingPlatformSettings.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

function readParkingCoverImage(
  settings: Record<string, unknown> | null | undefined
): string | null {
  if (!settings || typeof settings !== 'object') return null;
  const coverImage = settings.coverImage;
  if (typeof coverImage === 'string' && coverImage.trim()) return coverImage.trim();
  const images = settings.images;
  if (Array.isArray(images)) {
    const first = images.find((value) => typeof value === 'string' && value.trim());
    if (typeof first === 'string') return first.trim();
  }
  return null;
}

servePublic('get-parking-booking-status', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }


  const limited = await publicGetRateLimitGate(req, 'get-parking-booking-status', { maxPerMin: 30 });
  if (limited) return limited;

  const url = new URL(req.url);
  const bookingId = url.searchParams.get('bookingId')?.trim();
  if (!bookingId) {
    return jsonError(req, 'bookingId query param is required');
  }

  const supabase = createServiceClient();
  const { data: booking, error } = await supabase
    .from('guest_submissions')
    .select(
      'id, status, parking_id, parking_check_in_date, parking_check_out_date, check_in_date, check_out_date, parking_broadcast_expires_at, parking_payment_expires_at, parking_broadcast_batch_number, parking_endorsement_note, parking_request_organization_id, endorsement_sent_at, endorsement_send_error, endorsement_email_snapshot'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) {
    return jsonError(req, 'Not found', 404);
  }

  // Must be a parking request/booking row — never leak property stay bookings.
  const isParkingRow =
    Boolean(booking.parking_id) || Boolean(booking.parking_request_organization_id);
  if (!isParkingRow) {
    return jsonError(req, 'Not found', 404);
  }

  let parkingLabel: string | null = null;
  let parkingSlug: string | null = null;
  let parkingName: string | null = null;
  let residenceName: string | null = null;
  let coverImage: string | null = null;
  let brandColor = DEFAULT_ORG_BRAND_COLOR;
  let logoUrl: string | null = null;
  let organizationName: string | null = null;
  let hostContact: { name: string; email: string; phone: string | null } | null = null;

  if (booking.parking_id) {
    const { data: parking } = await supabase
      .from('parkings')
      .select('name, slug, slot_label, tower, residence_name, settings, organization_id')
      .eq('id', booking.parking_id)
      .maybeSingle();
    if (parking) {
      parkingLabel =
        [parking.slot_label, parking.tower].filter(Boolean).join(' · ') || parking.name;
      parkingSlug = (parking.slug as string | undefined) ?? null;
      parkingName = (parking.name as string | undefined) ?? null;
      residenceName = (parking.residence_name as string | undefined) ?? null;
      coverImage = readParkingCoverImage((parking.settings ?? {}) as Record<string, unknown>);
      brandColor = await loadResolvedBrandColorByParkingId(String(booking.parking_id));
      const orgSettings = await resolveOrgSettings(parking.organization_id as string);
      logoUrl = orgSettings.emailLogoUrl?.trim() || null;
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', parking.organization_id)
        .maybeSingle();
      organizationName = (org?.name as string | undefined) ?? null;

      // Phase 5 decision #6 — guest sees host contact only once endorsement is sent.
      if (booking.endorsement_sent_at) {
        hostContact = await resolveParkingHostContact(supabase, {
          id: String(booking.parking_id),
          organization_id: parking.organization_id as string,
        });
      }
    }
  } else if (booking.parking_request_organization_id) {
    const orgId = String(booking.parking_request_organization_id);
    const { data: org } = await supabase
      .from('organizations')
      .select('name, settings')
      .eq('id', orgId)
      .maybeSingle();
    organizationName = (org?.name as string | undefined) ?? null;
    brandColor = resolveOrgBrandColorFromSettings((org?.settings ?? {}) as Record<string, unknown>);
    const orgSettings = await resolveOrgSettings(orgId);
    logoUrl = orgSettings.emailLogoUrl?.trim() || null;
  }

  // Which TTL is live depends on status — parking_broadcast_expires_at is stale once claimed
  // (claim doesn't touch it), parking_payment_expires_at only applies during PENDING_PAYMENT.
  const expiresAt =
    booking.status === 'PENDING_PAYMENT'
      ? (booking.parking_payment_expires_at ?? null)
      : (booking.parking_broadcast_expires_at ?? null);

  const platformSettings = await resolveParkingPlatformSettings();

  return jsonSuccess(req, {
    status: booking.status,
    checkInDate: String(booking.parking_check_in_date ?? booking.check_in_date ?? ''),
    checkOutDate: String(booking.parking_check_out_date ?? booking.check_out_date ?? ''),
    expiresAt,
    batchNumber: Number(booking.parking_broadcast_batch_number ?? 1),
    parkingLabel,
    parkingSlug,
    parkingName,
    residenceName,
    coverImage,
    brandColor,
    logoUrl,
    endorsementNote: booking.parking_endorsement_note ?? null,
    organizationName,
    endorsementSentAt: booking.endorsement_sent_at ?? null,
    endorsementSendError: booking.endorsement_send_error ?? null,
    endorsementEmailSnapshot: booking.endorsement_sent_at
      ? (booking.endorsement_email_snapshot ?? null)
      : null,
    hostContact,
    supportEscalationPhone: platformSettings.supportEscalationPhone,
  });
});
