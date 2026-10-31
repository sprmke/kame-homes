/**
 * teamActivity — one-liner activity-log emitter for the org / property / parking
 * team endpoints (members, invitations, custom roles).
 *
 * Each handler resolves its access context with `requireOrgTeamContext` /
 * `requireTeamPropertyAccess` / `requireTeamParkingAccess`, then calls
 * `logTeamActivity({ ctx, req, action, ... })` after the mutating service call
 * succeeds. Never throws (delegates to `logActivity`).
 */

import {
  type ActivityAction,
  type ActorContext,
  buildActorContext,
  logActivity,
} from './activityLog.ts';

/** Structural subset shared by OrgTeamAccessContext / PropertyAccessContext / ParkingTeamAccessContext. */
type TeamCtxLike = {
  user: { id: string; email: string };
  org: { id: string };
  property?: { id: string; name?: string | null };
  parking?: { id: string; name?: string | null };
  accessKind: string;
  memberId?: string;
};

function ctxActor(ctx: TeamCtxLike, req: Request): ActorContext {
  const actorType =
    ctx.accessKind === 'owner'
      ? 'org_owner'
      : ctx.accessKind === 'platform_admin'
        ? 'super_admin'
        : 'team_member';
  return buildActorContext(
    'dashboard',
    { authUser: ctx.user, actorType, role: ctx.accessKind, memberId: ctx.memberId ?? null },
    req
  );
}

export async function logTeamActivity(input: {
  ctx: TeamCtxLike;
  req: Request;
  action: ActivityAction;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { ctx } = input;
    await logActivity({
      action: input.action,
      organizationId: ctx.org.id,
      propertyId: ctx.property?.id,
      parkingId: ctx.parking?.id,
      scope: ctx.parking ? 'parking' : ctx.property ? 'property' : 'org',
      actor: ctxActor(ctx, input.req),
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      metadata: {
        member_scope: ctx.parking ? 'parking' : ctx.property ? 'property' : 'org',
        ...(input.metadata ?? {}),
      },
    });
  } catch (err) {
    console.error('[teamActivity] logTeamActivity failed (non-fatal):', err);
  }
}
