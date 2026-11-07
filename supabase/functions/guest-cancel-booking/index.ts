/**
 * guest-cancel-booking — guest instant cancellation from the trip page.
 *
 * Auth: booking access token for this booking, or the signed-in guest who owns
 * it (same rule as `get-guest-trip`). The refund is always recomputed server-side.
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  CancellationNotAllowedError,
  cancelBooking,
  ensureBookingSnapshot,
  guestMustRequestCancellation,
  isCancellationReasonCode,
  loadPropertyCancellationContext,
  type CancellationReasonCode,
} from '../_shared/cancellationService.ts';
import { resolveCancellationPolicyDisplay } from '../_shared/cancellationPolicy.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { authorizeGuestTripAccess } from '../_shared/guestTripAccess.ts';
import { jsonError, jsonSuccess, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { createServiceClient, tryGetAuthenticatedUser } from '../_shared/orgAuth.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { releaseAppliedVoucherOnCancel } from '../_shared/voucherRedemption.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

servePublic('guest-cancel-booking', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const bookingId = String(body.bookingId ?? '').trim();
  if (!UUID_RE.test(bookingId)) return jsonError(req, 'Booking not found', 404);

  const user = await tryGetAuthenticatedUser(req);
  const limited = await rateLimitGate(req, {
    scope: 'guest-cancel-booking',
    identity: `${user?.id ?? 'anon'}:${bookingId}`,
    limit: 5,
    windowSec: 300,
  });
  if (limited) return limited;

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking || booking.parking_id) return jsonError(req, 'Booking not found', 404);

  const access = await authorizeGuestTripAccess({
    booking,
    accessToken: typeof body.accessToken === 'string' ? body.accessToken : null,
    user,
  });
  if (!access.ok) {
    return jsonError(
      req,
      access.reason === 'sign_in_required'
        ? 'Sign in with the email you booked with.'
        : 'Booking not found',
      access.reason === 'sign_in_required' ? 401 : 404
    );
  }

  if (String(booking.status ?? '') === 'CANCELLED') {
    return jsonSuccess(req, { alreadyCancelled: true });
  }
  if (String(booking.external_source ?? '').trim()) {
    return jsonError(req, 'This booking is managed on the channel where it was made.', 409);
  }
  if (body.confirm !== true) {
    return jsonError(req, 'Confirm the cancellation to continue.', 400);
  }

  const propertyId = String(booking.property_id ?? '');
  const context = await loadPropertyCancellationContext(propertyId);
  const snapshot = await ensureBookingSnapshot(booking);
  const policy = snapshot?.policy ?? context.policy;
  const display = resolveCancellationPolicyDisplay(policy);

  if (guestMustRequestCancellation(booking)) {
    return jsonError(
      req,
      'Your balance is paid, so your host reviews cancellation requests. Send a request instead.',
      409
    );
  }

  if (policy === null || policy.needsReview) {
    return jsonError(
      req,
      'This host reviews cancellation requests. Send a request instead.',
      409
    );
  }

  const reasonCode: CancellationReasonCode = isCancellationReasonCode(body.reasonCode)
    ? body.reasonCode
    : 'other';
  const reasonNote = typeof body.reasonNote === 'string' ? body.reasonNote.trim() : '';

  try {
    const result = await cancelBooking({
      booking,
      initiator: 'guest',
      reasonCode,
      reasonNote: reasonNote || null,
      notifyGuest: true,
      actor: buildActorContext(
        'public_form',
        {
          guest: {
            name: String(booking.primary_guest_name ?? '').trim() || null,
            email: String(booking.guest_email ?? '').trim() || null,
          },
        },
        req
      ),
    });

    try {
      await releaseAppliedVoucherOnCancel(createServiceClient(), {
        id: bookingId,
        applied_voucher_source_booking_id:
          (booking.applied_voucher_source_booking_id as string | null | undefined) ?? null,
      });
    } catch (voucherErr) {
      console.error('[guest-cancel-booking] voucher release failed (non-fatal):', voucherErr);
    }

    await logActivity({
      action: 'booking.refund_recorded',
      organizationId: result.refund?.organization_id ?? '',
      propertyId,
      actor: buildActorContext(
        'public_form',
        {
          guest: {
            name: String(booking.primary_guest_name ?? '').trim() || null,
            email: String(booking.guest_email ?? '').trim() || null,
          },
        },
        req
      ),
      targetType: 'booking',
      targetId: bookingId,
      targetLabel: String(booking.primary_guest_name ?? '') || null,
      metadata: {
        refund_due_php: result.outcome.refundDuePhp,
        refund_percent: result.outcome.refundPercent,
        policy_title: display.title,
      },
    });

    return jsonSuccess(req, {
      cancelled: true,
      outcome: result.outcome,
      refund: result.refund,
    });
  } catch (err) {
    if (err instanceof CancellationNotAllowedError) {
      return jsonError(req, err.message, err.status);
    }
    const message = err instanceof Error ? err.message : 'Could not cancel this booking.';
    if (message.toLowerCase().includes('status changed')) {
      return jsonError(req, 'This booking changed. Refresh and try again.', 409);
    }
    console.error('[guest-cancel-booking] failed:', err);
    return jsonError(req, message, 500);
  }
});
