/**
 * org-access — current user's permissions for an organization.
 * Auth: JWT + verifyOrgAccess (no specific permission required).
 * Query: ?org_id=uuid OR ?org_slug=slug
 */

import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { hasOrgPermission } from '../_shared/orgTeamPermissions.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('org-access', async (req) => {
  requireHttpMethod(req, 'GET');
  const ctx = await resolveOrgAccessContext(req);

  return jsonSuccess(req, {
    accessKind: ctx.accessKind,
    permissions: ctx.permissions,
    memberId: ctx.memberId ?? null,
    canListAllProperties: ctx.canListAllProperties,
    orgId: ctx.org.id,
    orgSlug: ctx.org.slug,
    orgName: ctx.org.name,
    planLimited: ctx.planLimited === true,
    canManageTeam: hasOrgPermission(ctx.permissions, 'org:team:manage'),
    canInviteTeam: hasOrgPermission(ctx.permissions, 'org:team:invite'),
    canCreateProperties: hasOrgPermission(ctx.permissions, 'org:properties:create'),
    canManageProperties: hasOrgPermission(ctx.permissions, 'org:properties:manage'),
    canCreateParkings: hasOrgPermission(ctx.permissions, 'org:parkings:create'),
    canManageParkings: hasOrgPermission(ctx.permissions, 'org:parkings:manage'),
    canEditBasicSettings: hasOrgPermission(ctx.permissions, 'org.settings.basic:edit'),
    canEditSocials: hasOrgPermission(ctx.permissions, 'org.settings.socials:edit'),
    canEditAiPlatform: hasOrgPermission(ctx.permissions, 'org.settings.aiPlatform:edit'),
    canEditAiAssistant: hasOrgPermission(ctx.permissions, 'org.settings.aiAssistant:edit'),
    canEditSettings:
      hasOrgPermission(ctx.permissions, 'org.settings.basic:edit') ||
      hasOrgPermission(ctx.permissions, 'org.settings.socials:edit') ||
      hasOrgPermission(ctx.permissions, 'org.settings.aiPlatform:edit') ||
      hasOrgPermission(ctx.permissions, 'org.settings.aiAssistant:edit'),
    canViewPlans: hasOrgPermission(ctx.permissions, 'org.plans:view'),
  });
});
