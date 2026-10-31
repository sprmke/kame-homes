/**
 * property-team-members — list, update, remove property team members.
 * Auth: JWT + verifyPropertyAccess (team:view | team:manage).
 * Query/body: property_id / propertyId (required).
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { catchPlanFeatureError } from '../_shared/planEntitlements.ts';
import { TEAM_API_PERMISSIONS } from '../_shared/propertyTeamPermissions.ts';
import {
  getPropertyTeamInviteCapacity,
  listPropertyTeamMembers,
  readTeamPropertyId,
  removePropertyTeamMember,
  requireTeamPropertyAccess,
  updatePropertyTeamMember,
} from '../_shared/propertyTeamService.ts';
import { logTeamActivity } from '../_shared/teamActivity.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('property-team-members', async (req) => {
  const url = new URL(req.url);
  const body = req.method === 'GET' ? {} : await readJsonBody(req);
  const propertyId = readTeamPropertyId(url, body);

  if (req.method === 'GET') {
    const ctx = await requireTeamPropertyAccess(req, propertyId, TEAM_API_PERMISSIONS.listMembers);
    const teamInviteCapacity = await getPropertyTeamInviteCapacity(ctx.org.id, ctx.property.id);
    const members = await listPropertyTeamMembers(ctx);
    return jsonSuccess(req, { members, teamInviteCapacity });
  }

  if (req.method === 'PATCH') {
    requireHttpMethod(req, 'PATCH');
    const ctx = await requireTeamPropertyAccess(req, propertyId, TEAM_API_PERMISSIONS.updateMember);
    try {
      const member = await updatePropertyTeamMember(ctx, body);
      await logTeamActivity({
        ctx,
        req,
        action: 'team.member_permissions_changed',
        targetType: 'member',
        targetId: typeof body.memberId === 'string' ? body.memberId : null,
      });
      return jsonSuccess(req, { member });
    } catch (e) {
      const planErr = catchPlanFeatureError(req, e);
      if (planErr) return planErr;
      const msg = e instanceof Error ? e.message : 'Update failed';
      return jsonError(req, msg, 400);
    }
  }

  if (req.method === 'DELETE') {
    requireHttpMethod(req, 'DELETE');
    const ctx = await requireTeamPropertyAccess(req, propertyId, TEAM_API_PERMISSIONS.removeMember);
    const memberId =
      typeof body.memberId === 'string'
        ? body.memberId.trim()
        : (url.searchParams.get('memberId')?.trim() ?? '');
    if (!memberId) {
      return jsonError(req, 'memberId is required');
    }
    try {
      await removePropertyTeamMember(ctx, memberId);
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
