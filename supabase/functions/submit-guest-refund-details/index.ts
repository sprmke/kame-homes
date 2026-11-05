/**
 * submit-guest-refund-details — guest payout details for a cancellation refund.
 *
 * POST { bookingId, accessToken?, method, bank?, accountName?, accountNumber?, phone? }
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { BOOKING_REFUND_COLUMNS } from '../_shared/cancellationService.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { authorizeGuestTripAccess } from '../_shared/guestTripAccess.ts';
import { jsonError, jsonSuccess, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { createServiceClient, tryGetAuthenticatedUser } from '../_shared/orgAuth.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHODS = new Set(['same_phone', 'other_bank', 'cash']);
const BANKS = new Set(['GCash', 'GoTyme', 'Maribank']);

servePublic('submit-guest-refund-details', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const bookingId = String(body.bookingId ?? '').trim();
  if (!UUID_RE.test(bookingId)) return jsonError(req, 'Booking not found', 404);

  const user = await tryGetAuthenticatedUser(req);
  const limited = await rateLimitGate(req, {
    scope: 'submit-guest-refund-details',
    identity: `${user?.id ?? 'anon'}:${bookingId}`,
    limit: 10,
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

  const method = String(body.method ?? '').trim();
  if (!METHODS.has(method)) return jsonError(req, 'Choose a refund method');
  const bank = method === 'other_bank' ? String(body.bank ?? '').trim() : '';
  if (method === 'other_bank' && !BANKS.has(bank)) {
    return jsonError(req, 'Choose a bank');
  }
  const accountName = method === 'other_bank' ? String(body.accountName ?? '').trim() : '';
  const accountNumber = method === 'other_bank' ? String(body.accountNumber ?? '').trim() : '';
  const phone = method === 'same_phone' ? String(body.phone ?? '').trim() : '';
  if (method === 'other_bank' && (!accountName || !accountNumber)) {
    return jsonError(req, 'Enter the account name and number');
  }
  if (method === 'same_phone' && !phone) {
    return jsonError(req, 'Enter the GCash number');
  }

  const sb = createServiceClient();
  const { data: refund } = await sb
    .from('booking_refunds')
    .select(BOOKING_REFUND_COLUMNS)
    .eq('booking_id', bookingId)
    .eq('kind', 'cancellation')
    .maybeSingle();
  if (!refund) return jsonError(req, 'No refund on file for this booking', 404);
  if (refund.status === 'sent') return jsonError(req, 'This refund was already sent.', 409);
  if (refund.status === 'not_due') return jsonError(req, 'No refund is due for this booking.', 409);

  const { data: updated, error } = await sb
    .from('booking_refunds')
    .update({
      method,
      bank: bank || null,
      account_name: accountName || null,
      account_number: accountNumber || null,
      phone: phone || null,
      status: 'pending',
    })
    .eq('id', refund.id)
    .select('id, status, amount_due_php, method, bank, account_name, account_number, phone')
    .maybeSingle();
  if (error) {
    console.error('[submit-guest-refund-details] update failed:', error);
    return jsonError(req, 'Could not save the refund details. Try again.', 500);
  }

  await logActivity({
    action: 'booking.refund_recorded',
    organizationId: String(refund.organization_id ?? ''),
    propertyId: String(refund.property_id),
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
    metadata: { refund_method: method, refund_id: String(refund.id) },
  });

  return jsonSuccess(req, { refund: updated });
});
