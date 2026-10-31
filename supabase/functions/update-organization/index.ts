/**
 * update-organization — PATCH org profile (name, brand, contacts).
 * Auth: JWT + org.settings.basic:edit (owners/platform admins always pass).
 */

import { verifyOrgAccess } from '../_shared/orgAuth.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  applyOrganizationProfilePatch,
  OrgProfilePatchError,
} from '../_shared/orgProfileService.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('update-organization', async (req) => {
  requireHttpMethod(req, 'PATCH');
  const body = await readJsonBody(req);

  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  if (!orgId) {
    return jsonError(req, 'orgId is required');
  }

  const orgAccess = await verifyOrgAccess(req, { orgId }, 'org.settings.basic:edit');
  const { org } = orgAccess;

  try {
    const organization = await applyOrganizationProfilePatch(org, {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl : undefined,
      tagline: typeof body.tagline === 'string' ? body.tagline : undefined,
      brandColor: typeof body.brandColor === 'string' ? body.brandColor : undefined,
      contactName: typeof body.contactName === 'string' ? body.contactName : undefined,
      contactRole: typeof body.contactRole === 'string' ? body.contactRole : undefined,
      contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone : undefined,
      contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail : undefined,
    });
    await logActivity({
      action: 'org.updated',
      organizationId: org.id,
      scope: 'org',
      actor: buildActorContext('dashboard', { orgAccess }, req),
      targetType: 'organization',
      targetId: org.id,
      targetLabel: (organization as { name?: string })?.name ?? org.name,
      metadata: {
        fields: Object.keys(body).filter((k) => k !== 'orgId' && body[k] !== undefined),
      },
    });
    return jsonSuccess(req, { organization });
  } catch (e) {
    if (e instanceof OrgProfilePatchError) {
      return jsonError(req, e.message, e.status);
    }
    console.error('[update-organization]', e instanceof Error ? e.message : e);
    return jsonError(req, 'Failed to update organization', 500);
  }
});
