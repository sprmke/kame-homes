/**
 * ai-platform-property-settings — Property-scoped GET for the AI on/off state.
 * Auth: property team member with settings:view.
 *
 * Read-only: the property AI switch is written by the org master toggle
 * (`ai-platform-settings` PATCH), never per property.
 */

import { getAiPlatformPropertySettings } from '../_shared/aiUsageService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('ai-platform-property-settings', async (req) => {
  if (req.method !== 'GET') return jsonError(req, 'Method not allowed', 405);
  const { property } = await resolveScopedPropertyAccess(req, 'settings:view');
  const settings = await getAiPlatformPropertySettings(property.id, property.organization_id);
  return jsonSuccess(req, {
    propertyId: settings.propertyId,
    organizationId: settings.organizationId,
    enabled: settings.enabled,
    updatedAt: settings.updatedAt,
  });
});
