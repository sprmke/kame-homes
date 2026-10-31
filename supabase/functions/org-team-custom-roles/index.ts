/**
 * org-team-custom-roles — CRUD org hub permission templates.
 * Auth: JWT + verifyOrgAccess (org.team:* leaves).
 * Mutations require plan feature `customRoles` (Starter+).
 */

import { verifyOrgAccess } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requireOrgPropertyFeature } from '../_shared/planEntitlements.ts';
import { ORG_TEAM_API_PERMISSIONS } from '../_shared/orgTeamPermissions.ts';
import {
  createOrgCustomRole,
  deleteOrgCustomRole,
  listOrgCustomRoles,
  readTeamOrgId,
  readTeamOrgSlug,
  requireOrgTeamContext,
  updateOrgCustomRole,
} from '../_shared/orgTeamService.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('org-team-custom-roles', async (req) => {
  const url = new URL(req.url);
  const body = req.method === 'GET' ? {} : await readJsonBody(req);
  const orgId = readTeamOrgId(url, body);
  const orgSlug = readTeamOrgSlug(url);

  if (req.method === 'GET') {
    await verifyOrgAccess(
      req,
      { orgId: orgId || undefined, orgSlug: orgSlug || undefined },
      ORG_TEAM_API_PERMISSIONS.listCustomRoles
    );
    const ctx = await requireOrgTeamContext(req, orgId, orgSlug);
    const customRoles = await listOrgCustomRoles(ctx.org.id);
    return jsonSuccess(req, { customRoles });
  }

  if (req.method === 'POST') {
    requireHttpMethod(req, 'POST');
    await verifyOrgAccess(
      req,
      { orgId: orgId || undefined, orgSlug: orgSlug || undefined },
      ORG_TEAM_API_PERMISSIONS.createCustomRole
    );
    const ctx = await requireOrgTeamContext(req, orgId, orgSlug);
    try {
      await requireOrgPropertyFeature(ctx.org.id, 'customRoles');
      const customRole = await createOrgCustomRole(ctx, body);
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
    await verifyOrgAccess(
      req,
      { orgId: orgId || undefined, orgSlug: orgSlug || undefined },
      ORG_TEAM_API_PERMISSIONS.updateCustomRole
    );
    const ctx = await requireOrgTeamContext(req, orgId, orgSlug);
    try {
      await requireOrgPropertyFeature(ctx.org.id, 'customRoles');
      const customRole = await updateOrgCustomRole(ctx, body);
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
    await verifyOrgAccess(
      req,
      { orgId: orgId || undefined, orgSlug: orgSlug || undefined },
      ORG_TEAM_API_PERMISSIONS.deleteCustomRole
    );
    const ctx = await requireOrgTeamContext(req, orgId, orgSlug);
    const roleId =
      typeof body.roleId === 'string'
        ? body.roleId.trim()
        : (url.searchParams.get('roleId')?.trim() ?? '');
    if (!roleId) {
      return jsonError(req, 'roleId is required');
    }
    try {
      await requireOrgPropertyFeature(ctx.org.id, 'customRoles');
      await deleteOrgCustomRole(ctx, roleId);
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
