/**
 * voice-receptionist-settings — Property-scoped GET/PATCH for AI voice receptionist config.
 * Auth: property team member (settings:view for GET, settings.voiceReceptionist:edit for PATCH).
 * Session limits are super-admin owned; PATCH rejects them with 403 `ai_limit_platform_managed`.
 */

import { HOST_VOICE_LIMIT_FIELDS, rejectPlatformManagedLimits } from '../_shared/aiLimitGuard.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  getVoiceReceptionistSettings,
  updateVoiceReceptionistSettings,
  validateVoiceReceptionistPatch,
} from '../_shared/voiceReceptionistService.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

serveAuthenticated('voice-receptionist-settings', async (req, user) => {
  const permission = req.method === 'GET' ? 'settings:view' : 'settings.voiceReceptionist:edit';
  const access = await resolveScopedPropertyAccess(req, permission);
  const { property } = access;

  if (req.method === 'GET') {
    const data = await getVoiceReceptionistSettings(property.id);
    return jsonSuccess(req, data);
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const rejected = rejectPlatformManagedLimits(req, body, HOST_VOICE_LIMIT_FIELDS);
    if (rejected) return rejected;
    const { patch, error } = validateVoiceReceptionistPatch(body);
    if (error) return jsonError(req, error, 400);
    if (patch.enabled === true) {
      try {
        await requirePropertyFeature(property.id, 'aiReceptionist');
      } catch (err) {
        const planErr = catchPlanFeatureError(req, err);
        if (planErr) return planErr;
        throw err;
      }
    }
    const data = await updateVoiceReceptionistSettings(property.id, patch);
    await logAssetActivity({
      req,
      user,
      action: 'integrations.config_changed',
      propertyId: property.id,
      organizationId: access.org.id,
      accessKind: access.accessKind,
      memberId: access.memberId,
      targetType: 'integration',
      targetId: property.id,
      targetLabel: property.name,
      changes: Object.keys(patch).map((field) => ({
        field,
        from: null,
        to: (patch as Record<string, unknown>)[field] ?? null,
      })),
      metadata: { provider: 'voice_receptionist', fields: Object.keys(patch) },
    });
    return jsonSuccess(req, data);
  }

  return jsonError(req, 'Method not allowed', 405);
});
