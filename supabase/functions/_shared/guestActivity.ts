/**
 * guestActivity — one-liner activity-log emitter for public / guest-facing edge
 * handlers (SD refund form, stay review, voucher claim, pay-parking, guest
 * profile). Resolves the org root from the booking's property / parking id,
 * builds a masked `guest` actor, writes one row, never throws.
 */

import {
  type ActivityAction,
  type ActivityScope,
  buildActorContext,
  logActivity,
} from './activityLog.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';
import { resolveOrganizationIdForParking } from './parkingScope.ts';

export async function logGuestActivity(input: {
  req: Request;
  action: ActivityAction;
  organizationId?: string | null;
  propertyId?: string | null;
  parkingId?: string | null;
  scope?: ActivityScope;
  guest?: { email?: string | null; name?: string | null };
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    let organizationId = input.organizationId ?? null;
    if (!organizationId && input.propertyId) {
      organizationId = await resolveOrganizationIdForProperty(input.propertyId).catch(() => null);
    }
    if (!organizationId && input.parkingId) {
      organizationId = await resolveOrganizationIdForParking(input.parkingId).catch(() => null);
    }
    if (!organizationId) return;

    await logActivity({
      action: input.action,
      organizationId,
      propertyId: input.propertyId ?? undefined,
      parkingId: input.parkingId ?? undefined,
      scope: input.scope ?? (input.parkingId ? 'parking' : input.propertyId ? 'property' : 'org'),
      actor: buildActorContext('public_form', { guest: input.guest ?? {} }, input.req),
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.error('[guestActivity] logGuestActivity failed (non-fatal):', err);
  }
}
