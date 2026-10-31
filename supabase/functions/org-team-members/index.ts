/**
 * org-team-members — list, update, remove organization team members.
 * Auth: JWT + verifyOrgTeamAccess.
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  getOrgTeamInviteCapacity,
  listOrgTeamMembers,
  readTeamOrgId,
  readTeamOrgSlug,
  removeOrgTeamMember,
  requireOrgTeamContext,
  updateOrgTeamMember,
} from '../_shared/orgTeamService.ts';
import { catchPlanFeatureError } from '../_shared/planEntitlements.ts';
import { logTeamActivity } from '../_shared/teamActivity.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('org-team-members', async (req) => {
  const url = new URL(req.url);
  const body = req.method === 'GET' ? {} : await readJsonBody(req);
  const orgId = readTeamOrgId(url, body);
  const orgSlug = readTeamOrgSlug(url);

  if (req.method === 'GET') {
    const ctx = await requireOrgTeamContext(req, orgId, orgSlug);
    const teamInviteCapacity = await getOrgTeamInviteCapacity(ctx.org.id);
    const members = await listOrgTeamMembers(ctx);
    return jsonSuccess(req, {
      members,
      teamInviteCapacity,
      access: {
        canManage: ctx.canManage,
        accessKind: ctx.accessKind,
      },
    });
  }

  if (req.method === 'PATCH') {
    requireHttpMethod(req, 'PATCH');
    const ctx = await requireOrgTeamContext(req, orgId, orgSlug);
    try {
      const member = await updateOrgTeamMember(ctx, body);
      await logTeamActivity({
        ctx,
        req,
        action: 'team.member_permissions_changed',
        targetType: 'member',
        targetId: typeof body.memberId === 'string' ? body.memberId : null,
        metadata: { fields: Object.keys(body).filter((k) => k !== 'memberId' && k !== 'orgId') },
      });
      return jsonSuccess(req, { member });
    } catch (e) {
      const planErr = catchPlanFeatureError(req, e);
      if (planErr) return planErr;
      const msg = e instanceof Error ? e.message : 'Update failed';
      const status = msg === 'Access restricted' ? 403 : msg === 'Member not found' ? 404 : 400;
      return jsonError(req, msg, status);
    }
  }

  if (req.method === 'DELETE') {
    requireHttpMethod(req, 'DELETE');
    const ctx = await requireOrgTeamContext(req, orgId, orgSlug, {
      requireMemberDelete: true,
    });
    const memberId =
      typeof body.memberId === 'string'
        ? body.memberId.trim()
        : (url.searchParams.get('memberId')?.trim() ?? '');
    if (!memberId) {
      return jsonError(req, 'memberId is required');
    }
    try {
      await removeOrgTeamMember(ctx, memberId);
      await logTeamActivity({
        ctx,
        req,
        action: 'team.member_removed',
        targetType: 'member',
        targetId: memberId,
      });
      return jsonSuccess(req, { removed: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Remove failed';
      return jsonError(req, msg, 400);
    }
  }

  return jsonError(req, 'Method not allowed', 405);
});
