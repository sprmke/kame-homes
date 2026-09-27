/**
 * ai-platform-settings — Org GET/PATCH for the AI on/off toggle.
 *
 * Hosts can only switch AI on or off. Every numeric limit is resolved server-side from
 * super-admin AI limit profiles (`_shared/aiLimitResolver.ts`); GET returns the resolved values
 * read-only for the usage panel, and PATCH rejects any limit field with 403
 * `ai_limit_platform_managed`.
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  getAiPlatformOrgSettings,
  syncPropertyAiEnabledForOrg,
  upsertAiPlatformOrgSettings,
} from '../_shared/aiUsageService.ts';
import { HOST_ORG_AI_LIMIT_FIELDS, rejectPlatformManagedLimits } from '../_shared/aiLimitGuard.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function toDto(settings: Awaited<ReturnType<typeof getAiPlatformOrgSettings>>) {
  return {
    organizationId: settings.organizationId,
    enabled: settings.enabled,
    dailyCallLimit: settings.dailyCallLimit,
    monthlyCallLimit: settings.monthlyCallLimit,
    dailyCostUsdLimit: settings.dailyCostUsdLimit,
    planTier: settings.planTier,
    updatedAt: settings.updatedAt,
  };
}

serveAuthenticated('ai-platform-settings', async (req, user) => {
  const ctx = await resolveOrgAccessContext(
    req,
    req.method === 'PATCH' ? 'org.settings.aiPlatform:edit' : 'org:settings:view'
  );

  if (req.method === 'GET') {
    return jsonSuccess(req, toDto(await getAiPlatformOrgSettings(ctx.org.id)));
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const rejected = rejectPlatformManagedLimits(req, body, HOST_ORG_AI_LIMIT_FIELDS);
    if (rejected) return rejected;
    if (typeof body.enabled !== 'boolean') {
      return jsonError(req, 'enabled must be a boolean', 400);
    }

    const before = await getAiPlatformOrgSettings(ctx.org.id);
    const settings = await upsertAiPlatformOrgSettings({
      organizationId: ctx.org.id,
      enabled: body.enabled,
      updatedBy: user.id,
    });

    if (before.enabled !== settings.enabled) {
      await syncPropertyAiEnabledForOrg(ctx.org.id, settings.enabled, user.id);
      await logActivity({
        action: 'ai.platform_toggled',
        organizationId: ctx.org.id,
        scope: 'org',
        actor: buildActorContext('dashboard', { orgAccess: ctx }, req),
        targetType: 'settings',
        targetId: ctx.org.id,
        targetLabel: ctx.org.name ?? 'the organization',
        metadata: {
          state: settings.enabled ? 'enabled' : 'disabled',
          syncedProperties: true,
        },
      });
    }
    return jsonSuccess(req, toDto(settings));
  }

  return jsonError(req, 'Method not allowed', 405);
});
