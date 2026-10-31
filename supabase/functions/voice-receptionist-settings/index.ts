/**
 * voice-receptionist-settings — Org GET/PATCH for the AI voice receptionist (on/off, voice,
 * persona, per-property opt-out). The guest runtime resolves each property's config from this.
 * Auth: any org member for GET; `org.settings.aiPlatform:edit` for PATCH.
 * Session limits are super-admin owned; PATCH rejects them with 403 `ai_limit_platform_managed`.
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { HOST_VOICE_LIMIT_FIELDS, rejectPlatformManagedLimits } from '../_shared/aiLimitGuard.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  catchPlanFeatureError,
  orgHasPropertyWithFeature,
  requireOrgPropertyFeature,
} from '../_shared/planEntitlements.ts';
import {
  listPropertyIdsForOrganization,
  resolveOrgAccessContext,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  getVoiceReceptionistOrgSettings,
  updateVoiceReceptionistOrgSettings,
  validateVoiceReceptionistPatch,
} from '../_shared/voiceReceptionistService.ts';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

serveAuthenticated('voice-receptionist-settings', async (req, user) => {
  if (req.method === 'GET') {
    const ctx = await resolveOrgAccessContext(req);
    const [settings, planAllowed] = await Promise.all([
      getVoiceReceptionistOrgSettings(ctx.org.id),
      orgHasPropertyWithFeature(ctx.org.id, 'aiReceptionist'),
    ]);
    return jsonSuccess(req, { ...settings, planAllowed });
  }

  if (req.method !== 'PATCH') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const ctx = await resolveOrgAccessContext(req, 'org.settings.aiPlatform:edit');
  const body = await readJsonBody(req);
  const rejected = rejectPlatformManagedLimits(req, body, HOST_VOICE_LIMIT_FIELDS);
  if (rejected) return rejected;

  const { patch, error } = validateVoiceReceptionistPatch(body);
  if (error) return jsonError(req, error, 400);

  let disabledPropertyIds: string[] | undefined;
  if (body.disabledPropertyIds !== undefined) {
    if (!isStringArray(body.disabledPropertyIds)) {
      return jsonError(req, 'disabledPropertyIds must be an array of strings', 400);
    }
    const orgPropertyIds = new Set(await listPropertyIdsForOrganization(ctx.org.id));
    const invalid = body.disabledPropertyIds.filter((id) => !orgPropertyIds.has(id));
    if (invalid.length > 0) {
      return jsonError(
        req,
        `disabledPropertyIds must belong to this organization: ${invalid.join(', ')}`,
        400
      );
    }
    disabledPropertyIds = body.disabledPropertyIds;
  }

  if (patch.enabled === true) {
    try {
      await requireOrgPropertyFeature(ctx.org.id, 'aiReceptionist');
    } catch (err) {
      const planErr = catchPlanFeatureError(req, err);
      if (planErr) return planErr;
      throw err;
    }
  }

  const settings = await updateVoiceReceptionistOrgSettings({
    organizationId: ctx.org.id,
    patch: { ...patch, disabledPropertyIds },
    updatedBy: user.id,
  });

  const fields = Object.keys(body).filter((key) => key !== 'settingsVerificationToken');
  await logActivity({
    action: 'ai.config_changed',
    organizationId: ctx.org.id,
    scope: 'org',
    actor: buildActorContext('dashboard', { orgAccess: ctx }, req),
    targetType: 'settings',
    targetId: ctx.org.id,
    targetLabel: ctx.org.name ?? 'the organization',
    metadata: {
      feature: 'voice_receptionist',
      state:
        typeof patch.enabled === 'boolean' ? (patch.enabled ? 'enabled' : 'disabled') : undefined,
      fields,
    },
  });

  const planAllowed = await orgHasPropertyWithFeature(ctx.org.id, 'aiReceptionist');
  return jsonSuccess(req, { ...settings, planAllowed });
});
