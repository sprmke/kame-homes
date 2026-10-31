/**
 * accept-property-invite — accept a pending property invitation after Google sign-in.
 * Auth: JWT (invitee). Body: { token }.
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { acceptPropertyInvitation } from '../_shared/propertyTeamService.ts';
import { resolveOrganizationIdForProperty } from '../_shared/propertyScope.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('accept-property-invite', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return jsonError(req, 'token is required');
  }

  try {
    const result = await acceptPropertyInvitation(user.id, user.email, token);
    try {
      const organizationId = await resolveOrganizationIdForProperty(result.propertyId);
      await logActivity({
        action: 'team.invite_accepted',
        organizationId,
        propertyId: result.propertyId,
        scope: 'property',
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
      console.error('[accept-property-invite] activity log failed (non-fatal):', activityErr);
    }
    await capturePostHogEvent('team_invite_accepted', {
      logPrefix: 'accept-property-invite',
      request: req,
      distinctId: user.id,
      properties: {
        property_id: result.propertyId,
        scope: 'property',
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
