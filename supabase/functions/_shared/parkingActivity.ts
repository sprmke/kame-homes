/**
 * parkingActivity — thin activity-log emitter for parking status changes.
 *
 * Parking has no orchestrator (`parkingStatusMachine.ts` is graph-only); status
 * writes are scattered across ~7 sites. Rather than refactor those writes, each
 * site calls `logParkingStatusChange(...)` right after it persists the new status.
 *
 * Never throws (delegates to `logActivity`). Plan: docs/workflow/planned/org-activity-audit-log.md
 */

import { createServiceClient } from './orgAuth.ts';
import { type ActorContext, logActivity, type ActivityAction } from './activityLog.ts';

type ParkingBookingLike = {
  id?: string | null;
  parking_id?: string | null;
  parking_request_organization_id?: string | null;
  primary_guest_name?: string | null;
  guest_facebook_name?: string | null;
  parking_check_in_date?: string | null;
  check_in_date?: string | null;
  [key: string]: unknown;
};

const CANCEL_STATUSES = new Set(['CANCELLED', 'NO_HOST_AVAILABLE']);

async function resolveParkingOrgId(booking: ParkingBookingLike): Promise<string | null> {
  const parkingId = typeof booking.parking_id === 'string' ? booking.parking_id.trim() : '';
  if (parkingId) {
    try {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from('parkings')
        .select('organization_id')
        .eq('id', parkingId)
        .maybeSingle();
      const orgId = data?.organization_id;
      if (typeof orgId === 'string' && orgId) return orgId;
    } catch (err) {
      console.error('[parkingActivity] org lookup failed (non-fatal):', err);
    }
  }
  const reqOrg = booking.parking_request_organization_id;
  return typeof reqOrg === 'string' && reqOrg ? reqOrg : null;
}

/**
 * Emit one activity row for a parking-booking status change. `action` defaults to
 * `parking.cancelled` for cancel/terminal statuses and `parking.status_changed`
 * otherwise; pass it explicitly for `parking.claimed` / `parking.declined`.
 */
export async function logParkingStatusChange(input: {
  booking: ParkingBookingLike;
  fromStatus: string;
  toStatus: string;
  actor: ActorContext;
  action?: Extract<
    ActivityAction,
    'parking.status_changed' | 'parking.cancelled' | 'parking.claimed' | 'parking.declined'
  >;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { booking, fromStatus, toStatus, actor } = input;
    const organizationId = await resolveParkingOrgId(booking);
    if (!organizationId) return;

    const action: ActivityAction =
      input.action ??
      (CANCEL_STATUSES.has(toStatus) ? 'parking.cancelled' : 'parking.status_changed');

    const guest =
      (typeof booking.primary_guest_name === 'string' && booking.primary_guest_name.trim()) ||
      (typeof booking.guest_facebook_name === 'string' && booking.guest_facebook_name.trim()) ||
      null;
    const day =
      (typeof booking.parking_check_in_date === 'string' && booking.parking_check_in_date) ||
      (typeof booking.check_in_date === 'string' && booking.check_in_date) ||
      null;

    await logActivity({
      action,
      organizationId,
      parkingId:
        typeof booking.parking_id === 'string' && booking.parking_id
          ? booking.parking_id
          : undefined,
      scope: 'parking',
      actor,
      targetType: 'parking_booking',
      targetId: typeof booking.id === 'string' ? booking.id : String(booking.id ?? ''),
      targetLabel: guest ? `${guest}${day ? ` · ${day}` : ''}` : 'a parking booking',
      metadata: {
        from_status: fromStatus,
        to_status: toStatus,
        ...(input.metadata ?? {}),
      },
    });
  } catch (err) {
    console.error('[parkingActivity] logParkingStatusChange failed (non-fatal):', err);
  }
}
