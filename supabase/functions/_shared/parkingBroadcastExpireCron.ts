/**
 * TTL expiry sweep for parking broadcast requests — when a batch's window passes with no
 * winner, dispatches the next ranked batch (`advanceOrTerminateParkingBatch`) or, once
 * candidates are exhausted, flips the booking to `NO_HOST_AVAILABLE`.
 */

import { createServiceClient } from './orgAuth.ts';
import { verifyCronSecret } from './cronSecretGate.ts';
import {
  fanOutParkingBroadcast,
  parkingBroadcastTtlMs,
  resolveNextParkingBatch,
} from './parkingBroadcast.ts';
import { sendParkingNoHostAvailableEmail } from './parkingBroadcastEmail.ts';
import { parkingAutomationEnabled } from './parkingAutomationToggles.ts';
import { releaseParkingClaim } from './parkingPaymentOrchestrator.ts';
import { buildActorContext } from './activityLog.ts';
import { logParkingStatusChange } from './parkingActivity.ts';

export function verifyParkingBroadcastExpireCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'PARKING_BROADCAST_EXPIRE_CRON_SECRET',
    headerName: 'x-parking-broadcast-expire-cron-secret',
  });
}

function mmDdYyyyToYyyyMmDd(value: string): string {
  const [mm, dd, yyyy] = value.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Resolves a fully-exhausted batch (all pending rows expired or declined): dispatches the
 * next ranked batch if candidates remain, else terminates to `NO_HOST_AVAILABLE`. Race-safe
 * against a concurrent claim/decline/expire via the same guarded-UPDATE idiom as those paths
 * (see `.cursor/rules/parking-workflow.mdc`) — the guard is `status = 'PENDING_HOST_ACCEPTANCE'
 * AND parking_broadcast_batch_number = fromBatchNumber`, so only the first caller to resolve a
 * given batch actually applies; a losing concurrent call simply no-ops. Never reimplement this
 * guard elsewhere — call this function instead.
 */
export async function advanceOrTerminateParkingBatch(
  bookingId: string,
  fromBatchNumber: number
): Promise<{ advanced: boolean; terminated: boolean }> {
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from('guest_submissions')
    .select(
      'id, guest_email, primary_guest_name, parking_request_organization_id, parking_pinned_id, requested_vehicle_type, parking_check_in_date, parking_check_out_date, check_in_date, check_out_date'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) return { advanced: false, terminated: false };

  const organizationId = String(booking.parking_request_organization_id ?? '');
  const checkInDb = String(booking.parking_check_in_date ?? booking.check_in_date ?? '');
  const checkOutDb = String(booking.parking_check_out_date ?? booking.check_out_date ?? '');
  const vehicleType = booking.requested_vehicle_type === 'motorcycle' ? 'motorcycle' : 'car';
  if (!organizationId || !checkInDb || !checkOutDb) {
    return { advanced: false, terminated: false };
  }

  const { data: previouslyBroadcast } = await supabase
    .from('parking_booking_broadcasts')
    .select('parking_id')
    .eq('booking_id', bookingId);
  const excludeParkingIds = [
    ...new Set((previouslyBroadcast ?? []).map((row) => String(row.parking_id))),
  ];

  // Pinned requests (guest requested one specific listing directly) stay single-round —
  // never silently broaden to other org parkings once that one candidate's batch is
  // exhausted (matches pre-batching Phase 1 behavior for this case).
  const isPinned = Boolean(booking.parking_pinned_id);
  const nextBatch = isPinned
    ? []
    : await resolveNextParkingBatch({
        organizationId,
        requestedVehicleType: vehicleType,
        checkInDate: checkInDb,
        checkOutDate: checkOutDb,
        excludeParkingIds,
      });

  const nowIso = new Date().toISOString();

  if (nextBatch.length === 0) {
    const { data: terminated, error: terminateError } = await supabase
      .from('guest_submissions')
      .update({ status: 'NO_HOST_AVAILABLE', status_updated_at: nowIso, updated_at: nowIso })
      .eq('id', bookingId)
      .eq('status', 'PENDING_HOST_ACCEPTANCE')
      .eq('parking_broadcast_batch_number', fromBatchNumber)
      .select('*')
      .maybeSingle();

    if (terminateError) {
      console.error('[advanceOrTerminateParkingBatch] terminate:', terminateError.message);
      return { advanced: false, terminated: false };
    }
    if (!terminated) return { advanced: false, terminated: false };

    await logParkingStatusChange({
      booking: terminated,
      fromStatus: 'PENDING_HOST_ACCEPTANCE',
      toStatus: 'NO_HOST_AVAILABLE',
      actor: buildActorContext('cron', { cron: 'expire-parking-broadcasts' }),
      metadata: { reason: 'no_candidates_left' },
    });

    const guestEmail = String(terminated.guest_email ?? '').trim();
    if (guestEmail && organizationId) {
      try {
        const parkingIdForToggle = excludeParkingIds[0] ?? null;
        const emailEnabled = await parkingAutomationEnabled(
          parkingIdForToggle,
          'emailParkingNoHostAvailable'
        );
        if (emailEnabled) {
          await sendParkingNoHostAvailableEmail({
            to: guestEmail,
            organizationId,
            checkInDate: checkInDb,
            checkOutDate: checkOutDb,
          });
        }
      } catch (err) {
        console.error(
          '[advanceOrTerminateParkingBatch] no-host-available email failed:',
          err instanceof Error ? err.message : err
        );
      }
    }
    return { advanced: false, terminated: true };
  }

  const nextBatchNumber = fromBatchNumber + 1;
  const checkInGuestFacing = mmDdYyyyToYyyyMmDd(checkInDb);
  const ttlMs = parkingBroadcastTtlMs(checkInGuestFacing);
  const expiresAtIso = new Date(Date.now() + ttlMs).toISOString();

  const { data: advanced, error: advanceError } = await supabase
    .from('guest_submissions')
    .update({
      parking_broadcast_batch_number: nextBatchNumber,
      parking_broadcast_expires_at: expiresAtIso,
      status_updated_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', bookingId)
    .eq('status', 'PENDING_HOST_ACCEPTANCE')
    .eq('parking_broadcast_batch_number', fromBatchNumber)
    .select('*')
    .maybeSingle();

  if (advanceError) {
    console.error('[advanceOrTerminateParkingBatch] advance:', advanceError.message);
    return { advanced: false, terminated: false };
  }
  if (!advanced) return { advanced: false, terminated: false };

  const guestName = String(booking.primary_guest_name ?? '').trim() || 'Guest';
  await fanOutParkingBroadcast(
    { id: bookingId, guestName, checkInDate: checkInDb, checkOutDate: checkOutDb, expiresAtIso },
    nextBatch,
    nextBatchNumber
  );

  return { advanced: true, terminated: false };
}

export async function runExpireParkingBroadcasts(): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: expiredBookings, error } = await supabase
    .from('guest_submissions')
    .select('id, parking_broadcast_batch_number')
    .eq('status', 'PENDING_HOST_ACCEPTANCE')
    .lt('parking_broadcast_expires_at', nowIso);

  if (error) {
    throw new Error(`runExpireParkingBroadcasts select: ${error.message}`);
  }

  let advancedCount = 0;
  let terminatedCount = 0;

  for (const booking of expiredBookings ?? []) {
    const bookingId = String(booking.id);
    const batchNumber = Number(booking.parking_broadcast_batch_number ?? 1);

    // Idempotent: closes out this batch's still-pending rows. Safe to re-run — a batch
    // that's already fully resolved (declined/claimed/previously expired) simply matches
    // zero rows here.
    const { error: expireBroadcastsError } = await supabase
      .from('parking_booking_broadcasts')
      .update({ response: 'expired', responded_at: nowIso })
      .eq('booking_id', bookingId)
      .eq('batch_number', batchNumber)
      .eq('response', 'pending');
    if (expireBroadcastsError) {
      console.error(
        '[expire-parking-broadcasts] mark batch expired:',
        expireBroadcastsError.message
      );
      continue;
    }

    try {
      const result = await advanceOrTerminateParkingBatch(bookingId, batchNumber);
      if (result.advanced) advancedCount += 1;
      if (result.terminated) terminatedCount += 1;
    } catch (err) {
      // One booking's candidate resolution failing (e.g. a pathologically large org) must
      // never abort the sweep for every other booking — log and move on, next tick retries.
      console.error(
        `[expire-parking-broadcasts] advanceOrTerminateParkingBatch failed for ${bookingId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return {
    scanned: expiredBookings?.length ?? 0,
    advanced: advancedCount,
    terminated: terminatedCount,
  };
}

/**
 * Payment-TTL sweep (Phase 3): a claimed booking whose payment window lapsed with no payment
 * gets released back to the search pool — `releaseParkingClaim` un-claims it, then
 * `advanceOrTerminateParkingBatch` resumes the search (next batch, or terminate once
 * candidates are exhausted). The guest didn't ask to stop, so this never lands on `CANCELLED`
 * — that's `cancelParkingBooking`'s job (guest-triggered, not a timeout).
 */
export async function runExpireParkingPayments(): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: expiredPayments, error } = await supabase
    .from('guest_submissions')
    .select('id')
    .eq('status', 'PENDING_PAYMENT')
    .lt('parking_payment_expires_at', nowIso);

  if (error) {
    throw new Error(`runExpireParkingPayments select: ${error.message}`);
  }

  let releasedCount = 0;
  let advancedCount = 0;
  let terminatedCount = 0;

  for (const booking of expiredPayments ?? []) {
    const bookingId = String(booking.id);
    try {
      const { released, batchNumber } = await releaseParkingClaim(bookingId);
      if (!released || batchNumber === null) continue;
      releasedCount += 1;

      const result = await advanceOrTerminateParkingBatch(bookingId, batchNumber);
      if (result.advanced) advancedCount += 1;
      if (result.terminated) terminatedCount += 1;
    } catch (err) {
      console.error(
        `[expire-parking-broadcasts] runExpireParkingPayments failed for ${bookingId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return {
    scanned: expiredPayments?.length ?? 0,
    released: releasedCount,
    advanced: advancedCount,
    terminated: terminatedCount,
  };
}
