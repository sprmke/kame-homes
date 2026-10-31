/**
 * Guest-initiated parking request cancellation (Phase 3, overview decision D7/#5) — allowed any
 * time before payment succeeds: while still searching (`PENDING_HOST_ACCEPTANCE`) or while a
 * payment window is open (`PENDING_PAYMENT`). Once paid, cancellation is not self-service.
 */

import { createServiceClient } from './orgAuth.ts';
import { buildActorContext } from './activityLog.ts';
import { logParkingStatusChange } from './parkingActivity.ts';
import {
  assertParkingGuestOwnership,
  ParkingGuestOwnershipError,
} from './parkingGuestOwnership.ts';
import { releaseParkingClaim } from './parkingPaymentOrchestrator.ts';

export class ParkingCancellationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function cancelParkingBooking(
  bookingId: string,
  userId: string,
  userEmail?: string | null
): Promise<{ cancelled: boolean }> {
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from('guest_submissions')
    .select(
      'id, status, guest_auth_user_id, parking_broadcast_batch_number, guest_email, ' +
        'parking_id, parking_request_organization_id, primary_guest_name, guest_facebook_name, ' +
        'parking_check_in_date'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) throw new ParkingCancellationError('Booking not found', 404);
  try {
    await assertParkingGuestOwnership(supabase, booking, { id: userId, email: userEmail });
  } catch (err) {
    if (err instanceof ParkingGuestOwnershipError) {
      throw new ParkingCancellationError(err.message, err.status);
    }
    throw err;
  }

  const nowIso = new Date().toISOString();

  if (booking.status === 'PENDING_HOST_ACCEPTANCE') {
    const { data: cancelled, error } = await supabase
      .from('guest_submissions')
      .update({ status: 'CANCELLED', status_updated_at: nowIso, updated_at: nowIso })
      .eq('id', bookingId)
      .eq('status', 'PENDING_HOST_ACCEPTANCE')
      .select('id')
      .maybeSingle();
    if (error) throw new ParkingCancellationError('Failed to cancel booking', 500);
    if (!cancelled) throw new ParkingCancellationError('Nothing to cancel', 409);

    await supabase
      .from('parking_booking_broadcasts')
      .update({ response: 'expired', responded_at: nowIso })
      .eq('booking_id', bookingId)
      .eq('batch_number', Number(booking.parking_broadcast_batch_number ?? 1))
      .eq('response', 'pending');

    await logParkingStatusChange({
      booking,
      fromStatus: 'PENDING_HOST_ACCEPTANCE',
      toStatus: 'CANCELLED',
      actor: buildActorContext('public_form', {
        guest: { email: userEmail ?? (booking.guest_email as string | null) },
      }),
      metadata: { initiated_by: 'guest' },
    });

    return { cancelled: true };
  }

  if (booking.status === 'PENDING_PAYMENT') {
    const { released } = await releaseParkingClaim(bookingId);
    if (!released) throw new ParkingCancellationError('Nothing to cancel', 409);

    // Terminal step, not a batch-advance — the guest asked to stop, not to keep searching.
    const { error } = await supabase
      .from('guest_submissions')
      .update({ status: 'CANCELLED', status_updated_at: nowIso, updated_at: nowIso })
      .eq('id', bookingId)
      .eq('status', 'PENDING_HOST_ACCEPTANCE');
    if (error) throw new ParkingCancellationError('Failed to cancel booking', 500);

    await logParkingStatusChange({
      booking,
      fromStatus: 'PENDING_PAYMENT',
      toStatus: 'CANCELLED',
      actor: buildActorContext('public_form', {
        guest: { email: userEmail ?? (booking.guest_email as string | null) },
      }),
      metadata: { initiated_by: 'guest' },
    });

    return { cancelled: true };
  }

  throw new ParkingCancellationError('This request can no longer be cancelled', 409);
}
