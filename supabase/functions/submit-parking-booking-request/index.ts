/**
 * submit-parking-booking-request — guest-authenticated submit for the parking broadcast flow
 * (Phase 3: was public/anon; the guest-facing Reserve/form flows already required sign-in
 * client-side before this endpoint was ever called, this just verifies it server-side too —
 * needed for ownership checks on cancel/pay-now and anti-spam rate limiting).
 * Inserts a pre-claim `PENDING_HOST_ACCEPTANCE` row (parking_id null) and fans out to
 * eligible candidates. Returns 422 with no insert when zero candidates are eligible.
 */

import { createServiceClient, type ParkingRow } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  fanOutParkingBroadcast,
  parkingBroadcastTtlMs,
  resolveNextParkingBatch,
} from '../_shared/parkingBroadcast.ts';
import { claimParkingBooking } from '../_shared/parkingBroadcastActions.ts';
import { parkingAutomationEnabled } from '../_shared/parkingAutomationToggles.ts';
import { assertParkingSubmitAllowed, ParkingAntiSpamError } from '../_shared/parkingAntiSpam.ts';
import { resolveParkingBookingChannel } from '../_shared/parkingDirectLink.ts';
import { ParkingLinkError, verifyLinkablePropertyBooking } from '../_shared/parkingPropertyLink.ts';
import { resolveParkingSubmitGuestAuthUserId } from '../_shared/parkingGuestOwnership.ts';
import {
  isSameOrgOwnerOwnedPin,
  readComplimentaryOwnerParking,
} from '../_shared/ownerDefaultParking.ts';
import {
  fulfillComplimentaryOwnerParking,
  ParkingPaymentError,
} from '../_shared/parkingPaymentOrchestrator.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { countStayNights } from '../_shared/utils.ts';
import { antiSpamGate } from '../_shared/antiSpam.ts';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toMmDdYyyy(yyyyMmDd: string): string {
  const [yyyy, mm, dd] = yyyyMmDd.split('-');
  return `${mm}-${dd}-${yyyy}`;
}

serveAuthenticated('submit-parking-booking-request', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  // Durable per-user rate limit + honeypot (no CAPTCHA — the request is already
  // behind the guest auth wall). Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
  const antiSpamBlocked = await antiSpamGate(req, body, {
    scope: 'submit-parking-booking-request',
    user,
    captcha: false,
    rateLimit: { limit: 10, windowSec: 3600 },
  });
  if (antiSpamBlocked) return antiSpamBlocked;

  const parkingId = typeof body.parkingId === 'string' ? body.parkingId.trim() : '';
  const bodyOrgId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
  const checkInDate = typeof body.checkInDate === 'string' ? body.checkInDate.trim() : '';
  const checkOutDate = typeof body.checkOutDate === 'string' ? body.checkOutDate.trim() : '';
  const vehicleType = body.vehicleType === 'motorcycle' ? 'motorcycle' : 'car';
  const primaryGuestName =
    typeof body.primaryGuestName === 'string' ? body.primaryGuestName.trim() : '';
  const guestEmail = typeof body.guestEmail === 'string' ? body.guestEmail.trim() : '';
  const guestPhone = typeof body.guestPhone === 'string' ? body.guestPhone.trim() : '';
  const unitNumber = typeof body.unitNumber === 'string' ? body.unitNumber.trim() : '';
  const carPlateNumber =
    typeof body.carPlateNumber === 'string' ? body.carPlateNumber.trim().toUpperCase() : '';
  const carBrandModel = typeof body.carBrandModel === 'string' ? body.carBrandModel.trim() : '';
  const carColor = typeof body.carColor === 'string' ? body.carColor.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const linkedPropertyBookingId =
    typeof body.linkedPropertyBookingId === 'string' ? body.linkedPropertyBookingId.trim() : '';
  const directLinkToken =
    typeof body.directLinkToken === 'string' ? body.directLinkToken.trim() : '';

  if (!parkingId && !bodyOrgId) {
    return jsonError(req, 'parkingId or organizationId is required');
  }
  if (!DATE_RE.test(checkInDate) || !DATE_RE.test(checkOutDate)) {
    return jsonError(req, 'checkInDate and checkOutDate must be YYYY-MM-DD');
  }
  if (checkOutDate <= checkInDate) {
    return jsonError(req, 'checkOutDate must be after checkInDate');
  }
  if (!primaryGuestName || primaryGuestName.length < 2) {
    return jsonError(req, 'primaryGuestName is required');
  }
  if (!EMAIL_RE.test(guestEmail)) {
    return jsonError(req, 'A valid guestEmail is required');
  }
  // No hard match-check against the authenticated user's own email: the admin dashboard's
  // "New booking" modal reuses this same endpoint to submit on a guest's behalf (see
  // docs/guides/routes/org/parking/bookings.md), where the caller (host) and guestEmail are
  // legitimately different people. guest_auth_user_id below is the real ownership binding for
  // pay-now/cancel, not this field. That same mismatch is also how we tell a genuine guest
  // self-submission apart from a host submitting on someone else's behalf — the anti-spam
  // limit below only applies to the former (a host legitimately creating several bookings for
  // different guests should never get rate-limited as if they were spamming).
  const isSelfServiceGuestSubmit = guestEmail.toLowerCase() === user.email.toLowerCase();
  if (isSelfServiceGuestSubmit) {
    try {
      await assertParkingSubmitAllowed(user.id);
    } catch (err) {
      if (err instanceof ParkingAntiSpamError) {
        return jsonError(req, err.message, err.status);
      }
      throw err;
    }
  }
  if (!unitNumber) {
    return jsonError(req, 'unitNumber is required');
  }
  if (!carPlateNumber) {
    return jsonError(req, 'carPlateNumber is required');
  }
  if (!carBrandModel) {
    return jsonError(req, 'carBrandModel is required');
  }
  if (!carColor) {
    return jsonError(req, 'carColor is required');
  }
  if (linkedPropertyBookingId) {
    try {
      await verifyLinkablePropertyBooking(linkedPropertyBookingId, user.id, user.email);
    } catch (err) {
      if (err instanceof ParkingLinkError) {
        return jsonError(req, err.message, err.status);
      }
      throw err;
    }
  }

  const supabase = createServiceClient();

  let organizationId = bodyOrgId;
  if (parkingId) {
    const { data: parking, error: parkingError } = await supabase
      .from('parkings')
      .select('id, organization_id, status')
      .eq('id', parkingId)
      .maybeSingle();
    if (parkingError || !parking || parking.status !== 'ACTIVE') {
      return jsonError(req, 'Parking not found', 404);
    }
    organizationId = String(parking.organization_id);
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .maybeSingle();
  if (orgError || !org) {
    return jsonError(req, 'Organization not found', 404);
  }

  const checkInDb = toMmDdYyyy(checkInDate);
  const checkOutDb = toMmDdYyyy(checkOutDate);

  // Phase 8 — only a pinned request (a specific listing's own link) can be a direct-link
  // booking; a channel token means nothing for an org-wide search request.
  const bookingChannel = parkingId
    ? await resolveParkingBookingChannel(parkingId, directLinkToken)
    : 'standard';

  const batch = await resolveNextParkingBatch({
    organizationId,
    requestedVehicleType: vehicleType,
    checkInDate: checkInDb,
    checkOutDate: checkOutDb,
    pinnedParkingId: parkingId || null,
  });

  if (batch.length === 0) {
    return jsonError(req, 'no_parking_available', 422);
  }

  const ttlMs = parkingBroadcastTtlMs(checkInDate);
  const expiresAtIso = new Date(Date.now() + ttlMs).toISOString();
  const guestName = primaryGuestName;

  const guestAuthUserId = resolveParkingSubmitGuestAuthUserId(user.id, isSelfServiceGuestSubmit);

  // Same-org owner-owned pin (property stay linked to the org's own listing): skip host
  // notify spam and auto-claim to PENDING_PAYMENT after fan-out inserts the broadcast row.
  const ownerOwnedSameOrg =
    Boolean(parkingId) &&
    Boolean(linkedPropertyBookingId) &&
    (await isSameOrgOwnerOwnedPin({
      pinnedParkingId: parkingId,
      linkedPropertyBookingId,
    }));

  const { data: inserted, error: insertError } = await supabase
    .from('guest_submissions')
    .insert({
      property_id: null,
      parking_id: null,
      parking_request_organization_id: organizationId,
      parking_pinned_id: parkingId || null,
      parking_booking_channel: bookingChannel,
      linked_property_booking_id: linkedPropertyBookingId || null,
      guest_auth_user_id: guestAuthUserId,
      requested_vehicle_type: vehicleType,
      status: 'PENDING_HOST_ACCEPTANCE',
      status_updated_at: new Date().toISOString(),
      parking_broadcast_expires_at: expiresAtIso,
      guest_facebook_name: guestName,
      primary_guest_name: guestName,
      guest_email: guestEmail,
      guest_phone_number: guestPhone || 'N/A',
      guest_address: 'N/A',
      check_in_date: checkInDb,
      check_out_date: checkOutDb,
      parking_check_in_date: checkInDb,
      parking_check_out_date: checkOutDb,
      number_of_nights: Math.max(1, countStayNights(checkInDb, checkOutDb)),
      number_of_adults: 1,
      number_of_children: 0,
      need_parking: true,
      has_pets: false,
      find_us: 'Parking',
      booking_source: 'Parking',
      payment_receipt_url: 'parking-only',
      valid_id_url: null,
      unit_owner: 'N/A',
      tower_and_unit_number: unitNumber,
      owner_onsite_contact_person: 'N/A',
      owner_contact_number: 'N/A',
      car_plate_number: carPlateNumber,
      car_brand_model: carBrandModel,
      car_color: carColor,
      guest_special_requests: notes || null,
    })
    .select('id, status, parking_broadcast_expires_at')
    .single();

  if (insertError || !inserted) {
    console.error('[submit-parking-booking-request]', insertError?.message);
    return jsonError(req, 'Failed to submit parking request', 500);
  }

  try {
    await fanOutParkingBroadcast(
      {
        id: String(inserted.id),
        guestName,
        checkInDate: checkInDb,
        checkOutDate: checkOutDb,
        expiresAtIso,
      },
      batch,
      1,
      ownerOwnedSameOrg ? { skipNotify: true } : undefined
    );
  } catch (err) {
    // Broadcast insert itself failed (not just a per-candidate notify failure, which
    // fanOutParkingBroadcast already swallows) — the booking row would otherwise sit at
    // PENDING_HOST_ACCEPTANCE with zero broadcast rows until the TTL cron eventually
    // times it out with a misleading "no host available" email. Roll it back instead so
    // the guest gets an honest error and can safely resubmit.
    console.error(
      '[submit-parking-booking-request] fan-out failed, rolling back booking:',
      err instanceof Error ? err.message : err
    );
    await supabase.from('guest_submissions').delete().eq('id', inserted.id);
    return jsonError(req, 'Failed to notify hosts, please try again', 500);
  }

  // Same-org owner-owned default: auto-claim immediately (no Accept self-notify).
  // Falls through to Phase 5 listing autoAcceptTopMatch when that toggle is on.
  try {
    const topCandidate = batch[0]?.candidate;
    const shouldAutoClaim =
      ownerOwnedSameOrg ||
      (topCandidate && (await parkingAutomationEnabled(topCandidate.id, 'autoAcceptTopMatch')));
    if (topCandidate && shouldAutoClaim) {
      const { data: parkingRow } = await supabase
        .from('parkings')
        .select('*')
        .eq('id', topCandidate.id)
        .maybeSingle();
      if (parkingRow) {
        let skipAwaitingPaymentEmail = false;
        if (ownerOwnedSameOrg && linkedPropertyBookingId) {
          const { data: propertyBooking } = await supabase
            .from('guest_submissions')
            .select('property_id')
            .eq('id', linkedPropertyBookingId)
            .maybeSingle();
          if (propertyBooking?.property_id) {
            const { data: propRow } = await supabase
              .from('properties')
              .select('settings')
              .eq('id', propertyBooking.property_id)
              .maybeSingle();
            skipAwaitingPaymentEmail = readComplimentaryOwnerParking(
              (propRow as { settings?: unknown } | null)?.settings
            );
          }
        }
        await claimParkingBooking(
          topCandidate.id,
          String(inserted.id),
          '',
          parkingRow as ParkingRow,
          { skipAwaitingPaymentEmail }
        );
        if (ownerOwnedSameOrg) {
          try {
            await fulfillComplimentaryOwnerParking(String(inserted.id));
          } catch (compErr) {
            // Not enabled / not eligible — leave PENDING_PAYMENT for PayMongo.
            if (!(compErr instanceof ParkingPaymentError && [403, 409].includes(compErr.status))) {
              console.error(
                '[submit-parking-booking-request] complimentary fulfill failed:',
                compErr instanceof Error ? compErr.message : compErr
              );
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(
      '[submit-parking-booking-request] auto-accept failed, leaving for manual accept:',
      err instanceof Error ? err.message : err
    );
  }

  const { data: refreshed } = await supabase
    .from('guest_submissions')
    .select('id, status, parking_broadcast_expires_at, parking_payment_expires_at')
    .eq('id', inserted.id)
    .maybeSingle();

  return jsonSuccess(req, {
    bookingId: inserted.id,
    status: refreshed?.status ?? inserted.status,
    expiresAt:
      refreshed?.parking_payment_expires_at ??
      refreshed?.parking_broadcast_expires_at ??
      inserted.parking_broadcast_expires_at,
  });
});
