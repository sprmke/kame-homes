/**
 * parking-team-invitations — list, invite, resend, cancel parking invitations.
 * Auth: JWT + verifyParkingTeamAccess (team:view | team:invite).
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
import { PARKING_TEAM_API_PERMISSIONS } from '../_shared/parkingTeamPermissions.ts';
import {
  cancelParkingInvitation,
  createParkingInvitation,
  listParkingTeamInvitations,
  readTeamParkingId,
  requireTeamParkingAccess,
  resendParkingInvitation,
} from '../_shared/parkingTeamService.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { logTeamActivity } from '../_shared/teamActivity.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('parking-team-invitations', async (req, user) => {
  const url = new URL(req.url);
  const body = req.method === 'GET' ? {} : await readJsonBody(req);
  const parkingId = readTeamParkingId(url, body);

  if (req.method === 'GET') {
    const ctx = await requireTeamParkingAccess(
      req,
      parkingId,
      PARKING_TEAM_API_PERMISSIONS.listInvitations
    );
    const invitations = await listParkingTeamInvitations(ctx.parking.id);
    return jsonSuccess(req, { invitations });
  }

  if (req.method === 'POST') {
    requireHttpMethod(req, 'POST');
    const action = parseAction(body);

    // Durable rate limit on invite/resend — per user + parking.
    // Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
    const isResend = action === 'resend';
    const limited = await rateLimitGate(req, {
      scope: `parking-team-invitations:${isResend ? 'resend' : 'invite'}`,
      identity: `${identityFromRequest(req, user)}:${parkingId || 'na'}`,
      limit: isResend ? 10 : 20,
      windowSec: 3600,
    });
    if (limited) return limited;

    if (action === 'resend') {
      const ctx = await requireTeamParkingAccess(
        req,
        parkingId,
        PARKING_TEAM_API_PERMISSIONS.resendInvitation
      );
      const invitationId = readInvitationId(body);
      if (!invitationId) {
        return jsonError(req, 'invitationId is required');
      }
      try {
        const invitation = await resendParkingInvitation(ctx, invitationId);
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

    const ctx = await requireTeamParkingAccess(
      req,
      parkingId,
      PARKING_TEAM_API_PERMISSIONS.inviteMember
    );
    try {
      const invitation = await createParkingInvitation(ctx, body);
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
      return jsonErrorFromCatch(req, e, 'Invite failed', { conflictOnAlready: true });
    }
  }

  if (req.method === 'DELETE') {
    requireHttpMethod(req, 'DELETE');
    const ctx = await requireTeamParkingAccess(
      req,
      parkingId,
      PARKING_TEAM_API_PERMISSIONS.cancelInvitation
    );
    const invitationId = readInvitationId(body, url);
    if (!invitationId) {
      return jsonError(req, 'invitationId is required');
    }
    try {
      await cancelParkingInvitation(ctx.parking.id, invitationId);
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
