/**
 * accept-parking-invite — accept a pending parking invitation after Google sign-in.
 * Auth: JWT (invitee). Body: { token }.
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { acceptParkingInvitation } from '../_shared/parkingTeamService.ts';
import { resolveOrganizationIdForParking } from '../_shared/parkingScope.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('accept-parking-invite', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return jsonError(req, 'token is required');
  }

  try {
    const result = await acceptParkingInvitation(user.id, user.email, token);
    try {
      const organizationId = await resolveOrganizationIdForParking(result.parkingId);
      await logActivity({
        action: 'team.invite_accepted',
        organizationId,
        parkingId: result.parkingId,
        scope: 'parking',
        actor: buildActorContext(
          'dashboard',
          { authUser: user, actorType: 'team_member', role: 'member', memberId: result.memberId },
          req
        ),
        targetType: 'member',
        targetId: result.memberId,
        targetLabel: user.email,
      });
    } catch (activityErr) {
      console.error('[accept-parking-invite] activity log failed (non-fatal):', activityErr);
    }
    await capturePostHogEvent('team_invite_accepted', {
      logPrefix: 'accept-parking-invite',
      request: req,
      distinctId: user.id,
      properties: {
        parking_id: result.parkingId,
        scope: 'parking',
      },
    });
    return jsonSuccess(req, result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Accept failed';
    const status = msg.includes('not found')
      ? 404
      : msg.includes('email must match') || msg.includes('does not match')
        ? 403
        : msg.includes('expired') || msg.includes('no longer valid')
          ? 410
          : 400;
    return jsonError(req, msg, status);
  }
});
