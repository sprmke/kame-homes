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
import { capturePostHogEvent } from '../_shared/posthog.ts';
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

    const publishing = isPublishingShowcase(pageType, body.config);
    // Only the first publish counts, so read the prior state before writing. Done only when
    // this save is publishing, so an ordinary autosave pays no extra query.
    const wasPublished = publishing
      ? isPublishingShowcase(
          pageType,
          (await getOrCreatePublicPageConfig(property.id, pageType)).config
        )
      : false;

    const row = await upsertPublicPageConfig(property.id, pageType, body.config);
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
    if (publishing && !wasPublished) {
      const createdAt = Date.parse(access.org.created_at);
      await capturePostHogEvent('listing_published', {
        logPrefix: 'public-page-configs',
        request: req,
        distinctId: user.id,
        groups: { organization: access.org.id, property: property.id },
        properties: {
          property_id: property.id,
          days_since_org_created: Number.isFinite(createdAt)
            ? Math.max(0, Math.round((Date.now() - createdAt) / 86_400_000))
            : null,
        },
      });
    }
    return jsonSuccess(req, {
      pageType: row.pageType,
      config: row.config as PropertyShowcaseConfig | typeof row.config,
      updatedAt: row.updatedAt,
    });
  }

  return jsonError(req, `Method ${req.method} not allowed`, 405);
});
