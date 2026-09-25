/**
 * ai-platform-settings — Org GET/PATCH for per-org AI allowance and enable toggle.
 */

import {
  getAiPlatformGlobalSettings,
  getAiPlatformOrgSettings,
  upsertAiPlatformOrgSettings,
} from '../_shared/aiUsageService.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('ai-platform-settings', async (req, user) => {
  const ctx = await resolveOrgAccessContext(
    req,
    req.method === 'PATCH' ? 'org.settings.aiPlatform:edit' : 'org:settings:view'
  );

  if (req.method === 'GET') {
    const settings = await getAiPlatformOrgSettings(ctx.org.id);
    return jsonSuccess(req, {
      organizationId: settings.organizationId,
      enabled: settings.enabled,
      dailyCallLimit: settings.dailyCallLimit,
      monthlyCallLimit: settings.monthlyCallLimit,
      dailyCostUsdLimit: settings.dailyCostUsdLimit,
      planTier: settings.planTier,
      updatedAt: settings.updatedAt,
    });
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
      return jsonError(req, 'enabled must be a boolean when provided', 400);
    }
    const daily = body.dailyCallLimit !== undefined ? Number(body.dailyCallLimit) : undefined;
    const monthly = body.monthlyCallLimit !== undefined ? Number(body.monthlyCallLimit) : undefined;
    const dailyCost =
      body.dailyCostUsdLimit !== undefined ? Number(body.dailyCostUsdLimit) : undefined;
    if (
      daily !== undefined &&
      (!Number.isFinite(daily) || daily <= 0 || !Number.isInteger(daily))
    ) {
      return jsonError(req, 'dailyCallLimit must be a positive integer', 400);
    }
    if (
      monthly !== undefined &&
      (!Number.isFinite(monthly) || monthly <= 0 || !Number.isInteger(monthly))
    ) {
      return jsonError(req, 'monthlyCallLimit must be a positive integer', 400);
    }
    if (dailyCost !== undefined && (!Number.isFinite(dailyCost) || dailyCost <= 0)) {
      return jsonError(req, 'dailyCostUsdLimit must be a positive number', 400);
    }

    // Org admins may tighten their AI limits, never raise them above the platform ceiling the
    // super admin sets (ai_platform_global_settings defaults) — otherwise any org admin could
    // lift their own spend guard.
    const platform = await getAiPlatformGlobalSettings();
    const ceilingError =
      daily !== undefined && daily > platform.defaultDailyCallLimit
        ? `dailyCallLimit cannot exceed ${platform.defaultDailyCallLimit}`
        : monthly !== undefined && monthly > platform.defaultMonthlyCallLimit
          ? `monthlyCallLimit cannot exceed ${platform.defaultMonthlyCallLimit}`
          : dailyCost !== undefined && dailyCost > platform.defaultDailyCostUsdLimit
            ? `dailyCostUsdLimit cannot exceed ${platform.defaultDailyCostUsdLimit}`
            : null;
    if (ceilingError) return jsonError(req, ceilingError, 400);

    const settings = await upsertAiPlatformOrgSettings({
      organizationId: ctx.org.id,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      dailyCallLimit: daily,
      monthlyCallLimit: monthly,
      dailyCostUsdLimit: dailyCost,
      updatedBy: user.id,
    });

    return jsonSuccess(req, {
      organizationId: settings.organizationId,
      enabled: settings.enabled,
      dailyCallLimit: settings.dailyCallLimit,
      monthlyCallLimit: settings.monthlyCallLimit,
      dailyCostUsdLimit: settings.dailyCostUsdLimit,
      planTier: settings.planTier,
      updatedAt: settings.updatedAt,
    });
  }

  return jsonError(req, 'Method not allowed', 405);
});
