/**
 * org-team-invitations — list, invite, resend, cancel organization invitations.
 * Auth: JWT + verifyOrgTeamAccess.
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
import {
  cancelOrgInvitation,
  createOrgInvitation,
  listOrgTeamInvitations,
  readTeamOrgId,
  readTeamOrgSlug,
  requireOrgTeamContext,
  resendOrgInvitation,
} from '../_shared/orgTeamService.ts';
import { catchPlanFeatureError } from '../_shared/planEntitlements.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('org-team-invitations', async (req, user) => {
  const url = new URL(req.url);
  const body = req.method === 'GET' ? {} : await readJsonBody(req);
  const orgId = readTeamOrgId(url, body);
  const orgSlug = readTeamOrgSlug(url);

  if (req.method === 'GET') {
    const ctx = await requireOrgTeamContext(req, orgId, orgSlug);
    const invitations = await listOrgTeamInvitations(ctx.org.id);
    return jsonSuccess(req, { invitations });
  }

  if (req.method === 'POST') {
    requireHttpMethod(req, 'POST');
    const action = parseAction(body);

    // Durable rate limit on invite/resend — per user + org.
    // Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
    const isResend = action === 'resend';
    const limited = await rateLimitGate(req, {
      scope: `org-team-invitations:${isResend ? 'resend' : 'invite'}`,
      identity: `${identityFromRequest(req, user)}:${orgId || orgSlug || 'na'}`,
      limit: isResend ? 10 : 20,
      windowSec: 3600,
    });
    if (limited) return limited;

    if (action === 'resend') {
      const ctx = await requireOrgTeamContext(req, orgId, orgSlug, {
        requireInvitationEdit: true,
      });
      const invitationId = readInvitationId(body);
      if (!invitationId) {
        return jsonError(req, 'invitationId is required');
      }
      try {
        const invitation = await resendOrgInvitation(ctx, invitationId);
        return jsonSuccess(req, { invitation });
      } catch (e) {
        return jsonErrorFromCatch(req, e, 'Resend failed');
      }
    }

    const ctx = await requireOrgTeamContext(req, orgId, orgSlug, {
      requireInvite: true,
    });
    try {
      const invitation = await createOrgInvitation(ctx, body);
      return jsonSuccess(req, { invitation });
    } catch (e) {
      const planErr = catchPlanFeatureError(req, e);
      if (planErr) return planErr;
      return jsonErrorFromCatch(req, e, 'Invite failed', { conflictOnAlready: true });
    }
  }

  if (req.method === 'DELETE') {
    requireHttpMethod(req, 'DELETE');
    const ctx = await requireOrgTeamContext(req, orgId, orgSlug, {
      requireInvitationDelete: true,
    });
    const invitationId = readInvitationId(body, url);
    if (!invitationId) {
      return jsonError(req, 'invitationId is required');
    }
    try {
      await cancelOrgInvitation(ctx.org.id, invitationId);
      return jsonSuccess(req, { cancelled: true });
    } catch (e) {
      return jsonErrorFromCatch(req, e, 'Cancel failed');
    }
  }

  return jsonError(req, 'Method not allowed', 405);
});
