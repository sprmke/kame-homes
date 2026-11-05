/**
 * record-booking-refund — host marks a refund sent, edits the amount, or records
 * a goodwill refund.
 *
 * POST { bookingId, action: 'mark_sent' | 'update' | 'goodwill', amountPhp?, proofUrl?, notes? }
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { BOOKING_REFUND_COLUMNS } from '../_shared/cancellationService.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { sendRefundSentGuest } from '../_shared/emailService.ts';
import { jsonError, jsonSuccess, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('record-booking-refund', async (req) => {
  requireHttpMethod(req, 'POST');
  const propertyAccess = await resolveScopedPropertyAccess(req, 'bookings.detail.workflow:edit');
  const propertyId = propertyAccess.property.id;
  const body = await readJsonBody(req);

  const bookingId = String(body.bookingId ?? '').trim();
  if (!bookingId) return jsonError(req, 'bookingId is required');
  await verifyBookingBelongsToProperty(bookingId, propertyId);

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) return jsonError(req, 'Booking not found', 404);

  const action = body.action === 'update' ? 'update' : body.action === 'goodwill' ? 'goodwill' : 'mark_sent';
  const actor = buildActorContext('dashboard', { propertyAccess }, req);
  const sb = createServiceClient();

  if (action === 'goodwill') {
    const amount = Number(body.amountPhp ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonError(req, 'Enter a refund amount');
    }
    const { data, error } = await sb
      .from('booking_refunds')
      .insert({
        booking_id: bookingId,
        property_id: propertyId,
        organization_id: (await resolveOrgId(propertyId)) ?? null,
        kind: 'goodwill',
        amount_due_php: amount,
        status: 'pending',
        notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
        created_by: actor.userId ?? null,
        breakdown: { kind: 'goodwill', reason: 'host_goodwill' },
      })
      .select(BOOKING_REFUND_COLUMNS)
      .maybeSingle();
    if (error) {
      console.error('[record-booking-refund] goodwill insert failed:', error);
      return jsonError(req, 'Could not record the refund. Try again.', 500);
    }
    await logActivity({
      action: 'booking.refund_recorded',
      organizationId: String(data.organization_id ?? ''),
      propertyId,
      actor,
      targetType: 'booking',
      targetId: bookingId,
      targetLabel: String(booking.primary_guest_name ?? '') || null,
      metadata: { kind: 'goodwill', amount_php: amount },
    });
    return jsonSuccess(req, { refund: data });
  }

  const { data: refund } = await sb
    .from('booking_refunds')
    .select(BOOKING_REFUND_COLUMNS)
    .eq('booking_id', bookingId)
    .eq('kind', 'cancellation')
    .maybeSingle();
  if (!refund) return jsonError(req, 'No cancellation refund on file', 404);
  if (refund.status === 'sent') return jsonError(req, 'This refund was already sent.', 409);

  if (action === 'update') {
    const amount = body.amountPhp === undefined ? undefined : Number(body.amountPhp);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      return jsonError(req, 'Enter a valid refund amount');
    }
    const { data, error } = await sb
      .from('booking_refunds')
      .update({
        ...(amount !== undefined ? { amount_due_php: amount } : {}),
        ...(typeof body.notes === 'string' ? { notes: body.notes.trim() || null } : {}),
      })
      .eq('id', refund.id)
      .select(BOOKING_REFUND_COLUMNS)
      .maybeSingle();
    if (error) return jsonError(req, 'Could not update the refund. Try again.', 500);
    return jsonSuccess(req, { refund: data });
  }

  // mark_sent
  const proofUrl = typeof body.proofUrl === 'string' ? body.proofUrl.trim() : '';
  if (!proofUrl) return jsonError(req, 'Upload a receipt before marking the refund sent.');
  const paidAmount =
    body.amountPaidPhp === undefined ? Number(refund.amount_due_php) : Number(body.amountPaidPhp);
  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    return jsonError(req, 'Enter a valid refund amount');
  }

  const { data: updated, error } = await sb
    .from('booking_refunds')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      proof_url: proofUrl,
      amount_paid_php: paidAmount,
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : refund.notes,
    })
    .eq('id', refund.id)
    .select(BOOKING_REFUND_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error('[record-booking-refund] mark sent failed:', error);
    return jsonError(req, 'Could not mark the refund sent. Try again.', 500);
  }

  await logActivity({
    action: 'booking.refund_sent',
    organizationId: String(refund.organization_id ?? ''),
    propertyId,
    actor,
    targetType: 'booking',
    targetId: bookingId,
    targetLabel: String(booking.primary_guest_name ?? '') || null,
    metadata: { amount_php: paidAmount, refund_id: String(refund.id) },
  });

  try {
    await sendRefundSentGuest(booking, { amountPhp: paidAmount, proofUrl });
  } catch (emailErr) {
    console.error('[record-booking-refund] refund email failed (non-fatal):', emailErr);
  }

  return jsonSuccess(req, { refund: updated });
});

async function resolveOrgId(propertyId: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  return data?.organization_id ? String(data.organization_id) : null;
}
