/**
 * assetActivity — one-liner activity-log emitter for property- / parking-scoped
 * admin handlers whose access resolver does not hand back a full
 * `PropertyAccessContext` / `ParkingTeamAccessContext` (finance, maintenance,
 * pricing, settings, templates, public pages).
 *
 * Resolves `organization_id` from the property / parking id when the caller does
 * not already have it, builds the actor from the authenticated user, and writes
 * one row. Never throws (delegates to `logActivity`).
 */

import {
  type ActivityAction,
  type ActivityChange,
  type ActivitySeverity,
  buildActorContext,
  logActivity,
} from './activityLog.ts';
import type { AuthenticatedUser } from './orgAuth.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';
import { resolveOrganizationIdForParking } from './parkingScope.ts';

export async function logAssetActivity(input: {
  req: Request;
  user: Pick<AuthenticatedUser, 'id' | 'email'>;
  action: ActivityAction;
  /** Provide one of propertyId / parkingId. */
  propertyId?: string | null;
  parkingId?: string | null;
  /** Skips the org lookup when already known. */
  organizationId?: string | null;
  /** `accessKind` snapshot for the actor role (owner / platform_admin / member / …). */
  accessKind?: string | null;
  memberId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  severity?: ActivitySeverity;
  changes?: ActivityChange[] | null;
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

    const role = input.accessKind ?? null;
    const actorType =
      role === 'owner' ? 'org_owner' : role === 'platform_admin' ? 'super_admin' : 'team_member';

    await logActivity({
      action: input.action,
      organizationId,
      propertyId: input.propertyId ?? undefined,
      parkingId: input.parkingId ?? undefined,
      scope: input.parkingId ? 'parking' : input.propertyId ? 'property' : 'org',
      actor: buildActorContext(
        'dashboard',
        {
          authUser: { id: input.user.id, email: input.user.email },
          actorType,
          role: role ?? undefined,
          memberId: input.memberId ?? null,
        },
        input.req
      ),
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      severity: input.severity,
      changes: input.changes ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.error('[assetActivity] logAssetActivity failed (non-fatal):', err);
  }
}
