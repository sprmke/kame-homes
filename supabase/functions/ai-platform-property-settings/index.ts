/**
 * ai-platform-property-settings — Property-scoped GET/PATCH for the AI on/off toggle.
 * Auth: property team member (settings:view for GET, settings.aiOverrides:edit for PATCH).
 *
 * Hosts only toggle AI for the property. Limits (calls, cost, credits, media caps) are resolved
 * from super-admin AI limit profiles; PATCH rejects any of them with 403 `ai_limit_platform_managed`.
 */

import {
  getAiPlatformPropertySettings,
  upsertAiPlatformPropertySettings,
} from '../_shared/aiUsageService.ts';
import {
  HOST_PROPERTY_AI_LIMIT_FIELDS,
  rejectPlatformManagedLimits,
} from '../_shared/aiLimitGuard.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function toDto(settings: Awaited<ReturnType<typeof getAiPlatformPropertySettings>>) {
  return {
    propertyId: settings.propertyId,
    organizationId: settings.organizationId,
    enabled: settings.enabled,
    updatedAt: settings.updatedAt,
  };
}

serveAuthenticated('ai-platform-property-settings', async (req, user) => {
  const permission = req.method === 'GET' ? 'settings:view' : 'settings.aiOverrides:edit';
  const { property } = await resolveScopedPropertyAccess(req, permission);

  if (req.method === 'GET') {
    return jsonSuccess(
      req,
      toDto(await getAiPlatformPropertySettings(property.id, property.organization_id))
    );
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const rejected = rejectPlatformManagedLimits(req, body, HOST_PROPERTY_AI_LIMIT_FIELDS);
    if (rejected) return rejected;
    if (typeof body.enabled !== 'boolean') {
      return jsonError(req, 'enabled must be a boolean', 400);
    }

    const before = await getAiPlatformPropertySettings(property.id, property.organization_id);
    const data = await upsertAiPlatformPropertySettings({
      propertyId: property.id,
      organizationId: property.organization_id,
      enabled: body.enabled,
      updatedBy: user.id,
    });

    if (before.enabled !== data.enabled) {
      await logAssetActivity({
        req,
        user,
        action: 'ai.platform_toggled',
        propertyId: property.id,
        organizationId: property.organization_id,
        targetType: 'settings',
        targetId: property.id,
        targetLabel: property.name,
        metadata: { state: data.enabled ? 'enabled' : 'disabled' },
      });
    }
    return jsonSuccess(req, toDto(data));
  }

  return jsonError(req, 'Method not allowed', 405);
});
