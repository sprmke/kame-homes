/**
 * parking-team-members — list, update, remove parking team members.
 * Auth: JWT + verifyParkingTeamAccess (team:view | team:manage).
 * Query/body: parking_id / parkingId (required).
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { PARKING_TEAM_API_PERMISSIONS } from '../_shared/parkingTeamPermissions.ts';
import {
  listParkingTeamMembers,
  readTeamParkingId,
  removeParkingTeamMember,
  requireTeamParkingAccess,
  updateParkingTeamMember,
} from '../_shared/parkingTeamService.ts';
import { logTeamActivity } from '../_shared/teamActivity.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('parking-team-members', async (req) => {
  const url = new URL(req.url);
  const body = req.method === 'GET' ? {} : await readJsonBody(req);
  const parkingId = readTeamParkingId(url, body);

  if (req.method === 'GET') {
    const ctx = await requireTeamParkingAccess(
      req,
      parkingId,
      PARKING_TEAM_API_PERMISSIONS.listMembers
    );
    const members = await listParkingTeamMembers(ctx);
    return jsonSuccess(req, { members });
  }

  if (req.method === 'PATCH') {
    requireHttpMethod(req, 'PATCH');
    const ctx = await requireTeamParkingAccess(
      req,
      parkingId,
      PARKING_TEAM_API_PERMISSIONS.updateMember
    );
    try {
      const member = await updateParkingTeamMember(ctx, body);
      await logTeamActivity({
        ctx,
        req,
        action: 'team.member_permissions_changed',
        targetType: 'member',
        targetId: typeof body.memberId === 'string' ? body.memberId : null,
      });
      return jsonSuccess(req, { member });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Update failed';
      return jsonError(req, msg, 400);
    }
  }

  if (req.method === 'DELETE') {
    requireHttpMethod(req, 'DELETE');
    const ctx = await requireTeamParkingAccess(
      req,
      parkingId,
      PARKING_TEAM_API_PERMISSIONS.removeMember
    );
    const memberId =
      typeof body.memberId === 'string'
        ? body.memberId.trim()
        : (url.searchParams.get('memberId')?.trim() ?? '');
    if (!memberId) {
      return jsonError(req, 'memberId is required');
    }
    try {
      await removeParkingTeamMember(ctx, memberId);
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
