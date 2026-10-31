/**
 * public-page-configs — Admin GET/PATCH for public page section configs.
 * Auth: publicPages:view | publicPages.property:edit | publicPages.stayGuide:edit | publicPages.showcase:edit
 * Plan gate: PATCH → `publicPagesAutosave` (Pro+ as of 20261210120000); property_showcase publish/template also needs `propertyShowcase`
 * Config shapes: stay_guide → StayGuideConfig v2 (v1 rows upgraded on normalize); property_landing / property_showcase unchanged.
 */

import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import {
  getOrCreatePublicPageConfig,
  normalizePropertyShowcaseConfig,
  parsePublicPageType,
  type PropertyShowcaseConfig,
  type PublicPageType,
  upsertPublicPageConfig,
} from '../_shared/publicPageConfigs.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import type { TeamPermissionId } from '../_shared/propertyTeamPermissions.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

function editPermissionForPageType(pageType: PublicPageType): TeamPermissionId {
  if (pageType === 'stay_guide') return 'publicPages.stayGuide:edit';
  if (pageType === 'property_showcase') return 'publicPages.showcase:edit';
  return 'publicPages.property:edit';
}

function isPublishingShowcase(pageType: PublicPageType, config: unknown): boolean {
  if (pageType !== 'property_showcase') return false;
  const normalized = normalizePropertyShowcaseConfig(config);
  return normalized.published === true;
}

serveAuthenticated('public-page-configs', async (req, user) => {
  if (req.method === 'GET') {
    const { property } = await resolveScopedPropertyAccess(req, 'publicPages:view');
    const url = new URL(req.url);
    const pageType = parsePublicPageType(url.searchParams.get('page_type'));
    if (!pageType) {
      return jsonError(
        req,
        'page_type must be stay_guide, property_landing, or property_showcase',
        400
      );
    }

    const row = await getOrCreatePublicPageConfig(property.id, pageType);
    return jsonSuccess(req, {
      pageType: row.pageType,
      config: row.config,
      updatedAt: row.updatedAt,
    });
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const pageType = parsePublicPageType(body.pageType ?? body.page_type);
    if (!pageType) {
      return jsonError(
        req,
        'pageType must be stay_guide, property_landing, or property_showcase',
        400
      );
    }
    if (body.config === undefined) {
      return jsonError(req, 'config is required', 400);
    }

    const access = await resolveScopedPropertyAccess(req, editPermissionForPageType(pageType));
    const { property } = access;
    try {
      await requirePropertyFeature(property.id, 'publicPagesAutosave');
      if (isPublishingShowcase(pageType, body.config)) {
        await requirePropertyFeature(property.id, 'propertyShowcase');
      }
    } catch (err) {
      const planErr = catchPlanFeatureError(req, err);
      if (planErr) return planErr;
      throw err;
    }

    const row = await upsertPublicPageConfig(property.id, pageType, body.config);
    const publishing = isPublishingShowcase(pageType, body.config);
    await logAssetActivity({
      req,
      user,
      action: publishing ? 'public_pages.published' : 'public_pages.config_saved',
      propertyId: property.id,
      organizationId: access.org.id,
      accessKind: access.accessKind,
      memberId: access.memberId,
      targetType: 'page_config',
      targetId: `${property.id}:${pageType}`,
      targetLabel: property.name,
      metadata: { page: pageType },
    });
    return jsonSuccess(req, {
      pageType: row.pageType,
      config: row.config as PropertyShowcaseConfig | typeof row.config,
      updatedAt: row.updatedAt,
    });
  }

  return jsonError(req, `Method ${req.method} not allowed`, 405);
});
