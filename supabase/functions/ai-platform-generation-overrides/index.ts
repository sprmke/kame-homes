/**
 * ai-platform-generation-overrides — Super-admin GET/PATCH for per-property
 * Marketing Studio generation sub-caps and the premium-tier escape hatch.
 *
 * Stored on `ai_platform_property_settings.feature_configs` (same JSONB as voice
 * receptionist). Hosts can set the credit caps from property AI overrides; only
 * this endpoint can flip `allow_premium_tier`.
 *
 * activity-log: N/A — platform-only super-admin surface (`super_admin_audit_events`).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';
import {
  listMarketingGenerationOverridesForOrg,
  parsePositiveIntOrNull,
  patchMarketingGenerationOverrides,
} from '../_shared/marketingGenerationFeatureConfig.ts';

async function resolveOrganization(
  orgId: string | null,
  orgSlug: string | null
): Promise<{ id: string; name: string } | null> {
  if (!orgId && !orgSlug) return null;
  const sb = createServiceClient();
  const query = sb.from('organizations').select('id, name');
  const { data, error } = orgId
    ? await query.eq('id', orgId).maybeSingle()
    : await query.eq('slug', orgSlug as string).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: data.id as string, name: data.name as string };
}

serveSuperAdmin('ai-platform-generation-overrides', async (req, admin) => {
  const stepUp = await requireSuperAdminStepUp(req, admin, 'ai_generation_overrides');
  if (stepUp) return stepUp;

  const url = new URL(req.url);
  const orgId =
    url.searchParams.get('org_id')?.trim() ||
    url.searchParams.get('organizationId')?.trim() ||
    null;
  const orgSlug = url.searchParams.get('org_slug')?.trim() || null;

  if (req.method === 'GET') {
    const org = await resolveOrganization(orgId, orgSlug);
    if (!org) return jsonError(req, 'Organization not found', 404);
    const properties = await listMarketingGenerationOverridesForOrg(org.id);
    return jsonSuccess(req, {
      organizationId: org.id,
      organizationName: org.name,
      properties: properties.map((row) => ({
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        ...row.overrides,
      })),
    });
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
    if (!propertyId) return jsonError(req, 'propertyId is required', 400);

    const sb = createServiceClient();
    const { data: property, error } = await sb
      .from('properties')
      .select('id, name, organization_id')
      .eq('id', propertyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!property) return jsonError(req, 'Property not found', 404);

    const imageCap = parsePositiveIntOrNull(body.imageMonthlyCreditCap, 'imageMonthlyCreditCap');
    if (!imageCap.ok) return jsonError(req, imageCap.error, 400);
    const videoCap = parsePositiveIntOrNull(body.videoMonthlyCreditCap, 'videoMonthlyCreditCap');
    if (!videoCap.ok) return jsonError(req, videoCap.error, 400);

    if (body.allowPremiumImage !== undefined && typeof body.allowPremiumImage !== 'boolean') {
      return jsonError(req, 'allowPremiumImage must be a boolean', 400);
    }
    if (body.allowPremiumVideo !== undefined && typeof body.allowPremiumVideo !== 'boolean') {
      return jsonError(req, 'allowPremiumVideo must be a boolean', 400);
    }

    const overrides = await patchMarketingGenerationOverrides({
      propertyId,
      organizationId: String(property.organization_id),
      patch: {
        imageMonthlyCreditCap: imageCap.value,
        videoMonthlyCreditCap: videoCap.value,
        allowPremiumImage:
          typeof body.allowPremiumImage === 'boolean' ? body.allowPremiumImage : undefined,
        allowPremiumVideo:
          typeof body.allowPremiumVideo === 'boolean' ? body.allowPremiumVideo : undefined,
      },
      updatedBy: admin.id,
    });

    await logSuperAdminAction(admin, {
      action: 'ai.generation_overrides_updated',
      targetType: 'property',
      targetId: propertyId,
      summary: `Updated AI generation overrides for ${String(property.name)}`,
      metadata: {
        organizationId: property.organization_id,
        ...overrides,
      },
    });

    return jsonSuccess(req, {
      propertyId,
      propertyName: property.name,
      ...overrides,
    });
  }

  return jsonError(req, 'Method not allowed', 405);
});
