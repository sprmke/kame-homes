/**
 * parking-team-custom-roles — CRUD custom roles for a parking slot.
 * Auth: JWT + verifyParkingTeamAccess (team:view | team:manage).
 * Mutations require plan feature `customRoles` (Starter+).
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  catchPlanFeatureError,
  requirePropertyFeature,
  resolveListingEntitlementPropertyId,
} from '../_shared/planEntitlements.ts';
import { PARKING_TEAM_API_PERMISSIONS } from '../_shared/parkingTeamPermissions.ts';
import {
  createParkingCustomRole,
  deleteParkingCustomRole,
  listParkingCustomRoles,
  readTeamParkingId,
  requireTeamParkingAccess,
  updateParkingCustomRole,
} from '../_shared/parkingTeamService.ts';
import { logTeamActivity } from '../_shared/teamActivity.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('parking-team-custom-roles', async (req) => {
  const url = new URL(req.url);
  const body = req.method === 'GET' ? {} : await readJsonBody(req);
  const parkingId = readTeamParkingId(url, body);

  if (req.method === 'GET') {
    const ctx = await requireTeamParkingAccess(
      req,
      parkingId,
      PARKING_TEAM_API_PERMISSIONS.listCustomRoles
    );
    const customRoles = await listParkingCustomRoles(ctx.parking.id);
    return jsonSuccess(req, { customRoles });
  }

  if (req.method === 'POST') {
    requireHttpMethod(req, 'POST');
    const ctx = await requireTeamParkingAccess(
      req,
      parkingId,
      PARKING_TEAM_API_PERMISSIONS.createCustomRole
    );
    try {
      const entitlementPropertyId = await resolveListingEntitlementPropertyId(
        'parking',
        ctx.parking.id
      );
      await requirePropertyFeature(entitlementPropertyId, 'customRoles');
      const customRole = await createParkingCustomRole(ctx, body);
      await logTeamActivity({
        ctx,
        req,
        action: 'team.custom_role_created',
        targetType: 'custom_role',
        targetId: (customRole as { id?: string })?.id ?? null,
        targetLabel: (customRole as { name?: string })?.name ?? null,
      });
      return jsonSuccess(req, { customRole });
    } catch (e) {
      const planErr = catchPlanFeatureError(req, e);
      if (planErr) return planErr;
      const msg = e instanceof Error ? e.message : 'Create failed';
      const status = msg.includes('already exists') ? 409 : 400;
      return jsonError(req, msg, status);
    }
  }

  if (req.method === 'PATCH') {
    requireHttpMethod(req, 'PATCH');
    const ctx = await requireTeamParkingAccess(
      req,
      parkingId,
      PARKING_TEAM_API_PERMISSIONS.updateCustomRole
    );
    try {
      const entitlementPropertyId = await resolveListingEntitlementPropertyId(
        'parking',
        ctx.parking.id
      );
      await requirePropertyFeature(entitlementPropertyId, 'customRoles');
      const customRole = await updateParkingCustomRole(ctx, body);
      await logTeamActivity({
        ctx,
        req,
        action: 'team.custom_role_updated',
        targetType: 'custom_role',
        targetId: (customRole as { id?: string })?.id ?? null,
        targetLabel: (customRole as { name?: string })?.name ?? null,
      });
      return jsonSuccess(req, { customRole });
    } catch (e) {
      const planErr = catchPlanFeatureError(req, e);
      if (planErr) return planErr;
      const msg = e instanceof Error ? e.message : 'Update failed';
      const status = msg.includes('already exists') ? 409 : 400;
      return jsonError(req, msg, status);
    }
  }

  if (req.method === 'DELETE') {
    requireHttpMethod(req, 'DELETE');
    const ctx = await requireTeamParkingAccess(
      req,
      parkingId,
      PARKING_TEAM_API_PERMISSIONS.deleteCustomRole
    );
    const roleId =
      typeof body.roleId === 'string'
        ? body.roleId.trim()
        : (url.searchParams.get('roleId')?.trim() ?? '');
    if (!roleId) {
      return jsonError(req, 'roleId is required');
    }
    try {
      const entitlementPropertyId = await resolveListingEntitlementPropertyId(
        'parking',
        ctx.parking.id
      );
      await requirePropertyFeature(entitlementPropertyId, 'customRoles');
      await deleteParkingCustomRole(ctx, roleId);
      await logTeamActivity({
        ctx,
        req,
        action: 'team.custom_role_deleted',
        targetType: 'custom_role',
        targetId: roleId,
      });
      return jsonSuccess(req, { deleted: true });
    } catch (e) {
      const planErr = catchPlanFeatureError(req, e);
      if (planErr) return planErr;
      const msg = e instanceof Error ? e.message : 'Delete failed';
      return jsonError(req, msg, 400);
    }
  }

  return jsonError(req, 'Method not allowed', 405);
});
