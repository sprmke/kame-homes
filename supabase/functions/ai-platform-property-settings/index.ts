/**
 * ai-platform-property-settings — Property-scoped GET/PATCH for AI platform overrides.
 * Auth: property team member (settings:view for GET, settings:edit for PATCH).
 */

import {
  getAiPlatformPropertySettings,
  upsertAiPlatformPropertySettings,
} from '../_shared/aiUsageService.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import {
  getMarketingGenerationOverrides,
  parsePositiveIntOrNull,
  patchMarketingGenerationOverrides,
} from '../_shared/marketingGenerationFeatureConfig.ts';

serveAuthenticated('ai-platform-property-settings', async (req, user) => {
  const permission = req.method === 'GET' ? 'settings:view' : 'settings.aiOverrides:edit';
  const { property } = await resolveScopedPropertyAccess(req, permission);

  if (req.method === 'GET') {
    const data = await getAiPlatformPropertySettings(property.id, property.organization_id);
    const generation = await getMarketingGenerationOverrides(property.id, property.organization_id);
    return jsonSuccess(req, { ...data, ...generation });
  }

  if (req.method === 'PATCH') {
    try {
      await requirePropertyFeature(property.id, 'aiMonthlyCreditAllowance');
    } catch (err) {
      const planErr = catchPlanFeatureError(req, err);
      if (planErr) return planErr;
      throw err;
    }
    const body = await readJsonBody(req);
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
      return jsonError(req, 'enabled must be a boolean when provided', 400);
    }
    const daily =
      body.dailyCallLimit === undefined
        ? undefined
        : body.dailyCallLimit === null || body.dailyCallLimit === ''
          ? null
          : Number(body.dailyCallLimit);
    const monthly =
      body.monthlyCallLimit === undefined
        ? undefined
        : body.monthlyCallLimit === null || body.monthlyCallLimit === ''
          ? null
          : Number(body.monthlyCallLimit);
    const dailyCost =
      body.dailyCostUsdLimit === undefined
        ? undefined
        : body.dailyCostUsdLimit === null || body.dailyCostUsdLimit === ''
          ? null
          : Number(body.dailyCostUsdLimit);
    if (daily != null && (!Number.isFinite(daily) || daily <= 0 || !Number.isInteger(daily))) {
      return jsonError(req, 'dailyCallLimit must be a positive integer', 400);
    }
    if (
      monthly != null &&
      (!Number.isFinite(monthly) || monthly <= 0 || !Number.isInteger(monthly))
    ) {
      return jsonError(req, 'monthlyCallLimit must be a positive integer', 400);
    }
    if (dailyCost != null && (!Number.isFinite(dailyCost) || dailyCost <= 0)) {
      return jsonError(req, 'dailyCostUsdLimit must be a positive number', 400);
    }

    const data = await upsertAiPlatformPropertySettings({
      propertyId: property.id,
      organizationId: property.organization_id,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      dailyCallLimit: daily,
      monthlyCallLimit: monthly,
      dailyCostUsdLimit: dailyCost,
      updatedBy: user.id,
    });

    const imageCap = parsePositiveIntOrNull(body.imageMonthlyCreditCap, 'imageMonthlyCreditCap');
    if (!imageCap.ok) return jsonError(req, imageCap.error, 400);
    const videoCap = parsePositiveIntOrNull(body.videoMonthlyCreditCap, 'videoMonthlyCreditCap');
    if (!videoCap.ok) return jsonError(req, videoCap.error, 400);

    let generation = await getMarketingGenerationOverrides(property.id, property.organization_id);
    if (imageCap.value !== undefined || videoCap.value !== undefined) {
      generation = await patchMarketingGenerationOverrides({
        propertyId: property.id,
        organizationId: property.organization_id,
        patch: {
          imageMonthlyCreditCap: imageCap.value,
          videoMonthlyCreditCap: videoCap.value,
        },
        updatedBy: user.id,
      });
      await logAssetActivity({
        req,
        user,
        action: 'settings.updated',
        propertyId: property.id,
        organizationId: property.organization_id,
        targetType: 'settings',
        targetId: property.id,
        metadata: { area: 'AI generation caps' },
      });
    }

    return jsonSuccess(req, { ...data, ...generation });
  }

  return jsonError(req, 'Method not allowed', 405);
});
