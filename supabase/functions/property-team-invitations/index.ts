/**
 * property-team-invitations — list, invite, resend, cancel property invitations.
 * Auth: JWT + verifyPropertyAccess (team:view | team:invite).
 */

import {
  jsonError,
  jsonErrorFromCatch,
  jsonSuccess,
  parseAction,
  readInvitationId,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requireTeamInviteAllowed } from '../_shared/planEntitlements.ts';
import { TEAM_API_PERMISSIONS } from '../_shared/propertyTeamPermissions.ts';
import {
  cancelPropertyInvitation,
  createPropertyInvitation,
  listPropertyTeamInvitations,
  readTeamPropertyId,
  requireTeamPropertyAccess,
  resendPropertyInvitation,
} from '../_shared/propertyTeamService.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { logTeamActivity } from '../_shared/teamActivity.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('property-team-invitations', async (req, user) => {
  const url = new URL(req.url);
  const body = req.method === 'GET' ? {} : await readJsonBody(req);
  const propertyId = readTeamPropertyId(url, body);

  if (req.method === 'GET') {
    const ctx = await requireTeamPropertyAccess(
      req,
      propertyId,
      TEAM_API_PERMISSIONS.listInvitations
    );
    const invitations = await listPropertyTeamInvitations(ctx.property.id);
    return jsonSuccess(req, { invitations });
  }

  if (req.method === 'POST') {
    requireHttpMethod(req, 'POST');
    const action = parseAction(body);

    // Durable rate limit on invite/resend — per user + property.
    // Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
    const isResend = action === 'resend';
    const limited = await rateLimitGate(req, {
      scope: `property-team-invitations:${isResend ? 'resend' : 'invite'}`,
      identity: `${identityFromRequest(req, user)}:${propertyId || 'na'}`,
      limit: isResend ? 10 : 20,
      windowSec: 3600,
    });
    if (limited) return limited;

    if (action === 'resend') {
      const ctx = await requireTeamPropertyAccess(
        req,
        propertyId,
        TEAM_API_PERMISSIONS.resendInvitation
      );
      const invitationId = readInvitationId(body);
      if (!invitationId) {
        return jsonError(req, 'invitationId is required');
      }
      try {
        const invitation = await resendPropertyInvitation(ctx, invitationId);
        await logTeamActivity({
          ctx,
          req,
          action: 'team.invite_resent',
          targetType: 'invitation',
          targetId: invitationId,
          targetLabel: (invitation as { email?: string })?.email ?? null,
        });
        return jsonSuccess(req, { invitation });
      } catch (e) {
        return jsonErrorFromCatch(req, e, 'Resend failed');
      }
    }

    const ctx = await requireTeamPropertyAccess(req, propertyId, TEAM_API_PERMISSIONS.inviteMember);
    try {
      await requireTeamInviteAllowed(ctx.property.id);
      const invitation = await createPropertyInvitation(ctx, body);
      await logTeamActivity({
        ctx,
        req,
        action: 'team.invite_sent',
        targetType: 'invitation',
        targetId: (invitation as { id?: string })?.id ?? null,
        targetLabel: (invitation as { email?: string })?.email ?? null,
      });
      return jsonSuccess(req, { invitation });
    } catch (e) {
      const planErr = catchPlanFeatureError(req, e);
      if (planErr) return planErr;
      return jsonErrorFromCatch(req, e, 'Invite failed', { conflictOnAlready: true });
    }
  }

  if (req.method === 'DELETE') {
    requireHttpMethod(req, 'DELETE');
    const ctx = await requireTeamPropertyAccess(
      req,
      propertyId,
      TEAM_API_PERMISSIONS.cancelInvitation
    );
    const invitationId = readInvitationId(body, url);
    if (!invitationId) {
      return jsonError(req, 'invitationId is required');
    }
    try {
      await cancelPropertyInvitation(ctx.property.id, invitationId);
      await logTeamActivity({
        ctx,
        req,
        action: 'team.invite_revoked',
        targetType: 'invitation',
        targetId: invitationId,
      });
      return jsonSuccess(req, { cancelled: true });
    } catch (e) {
      return jsonErrorFromCatch(req, e, 'Cancel failed');
    }
  }

  return jsonError(req, 'Method not allowed', 405);
});
