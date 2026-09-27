/**
 * dashboard-assistant-settings — Org GET/PATCH for the AI dashboard assistant opt-in and
 * per-property disable list. Message/write-action limits are super-admin owned (resolved through
 * `_shared/aiLimitResolver.ts`); PATCH rejects them with 403 `ai_limit_platform_managed`.
 */

import {
  getDashboardAssistantGlobalSettings,
  getDashboardAssistantOrgSettings,
  getDashboardAssistantUsageSummary,
  upsertDashboardAssistantOrgSettings,
} from '../_shared/dashboardAssistantSettings.ts';
import {
  HOST_ASSISTANT_LIMIT_FIELDS,
  rejectPlatformManagedLimits,
} from '../_shared/aiLimitGuard.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  listPropertyIdsForOrganization,
  resolveOrgAccessContext,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';

function isUuidArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Internal override notes are for super admins; never send them to hosts. */
function hostSafe(settings: Awaited<ReturnType<typeof getDashboardAssistantOrgSettings>>) {
  const { overrideReason: _internal, ...rest } = settings;
  return rest;
}

serveAuthenticated('dashboard-assistant-settings', async (req, user) => {
  if (req.method === 'GET') {
    // No permission gate on read — any org/property member needs this to know whether the
    // assistant launcher should render, not just settings-page-capable admins.
    const ctx = await resolveOrgAccessContext(req);
    const includeUsage = new URL(req.url).searchParams.get('includeUsage') === 'true';
    const [settings, global, usage] = await Promise.all([
      getDashboardAssistantOrgSettings(ctx.org.id),
      getDashboardAssistantGlobalSettings(),
      includeUsage ? getDashboardAssistantUsageSummary(ctx.org.id) : Promise.resolve(null),
    ]);
    return jsonSuccess(req, {
      ...hostSafe(settings),
      platformEnabled: global.enabled,
      aiModeEnabled: global.enabled && global.aiModeEnabled,
      usage,
    });
  }

  const ctx = await resolveOrgAccessContext(req, 'org.settings.aiAssistant:edit');

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const rejected = rejectPlatformManagedLimits(req, body, HOST_ASSISTANT_LIMIT_FIELDS);
    if (rejected) return rejected;
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
      return jsonError(req, 'enabled must be a boolean when provided', 400);
    }
    if (body.disabledPropertyIds !== undefined && !isUuidArray(body.disabledPropertyIds)) {
      return jsonError(req, 'disabledPropertyIds must be an array of strings when provided', 400);
    }

    if (isUuidArray(body.disabledPropertyIds) && body.disabledPropertyIds.length > 0) {
      const orgPropertyIds = new Set(await listPropertyIdsForOrganization(ctx.org.id));
      const invalid = body.disabledPropertyIds.filter((id) => !orgPropertyIds.has(id));
      if (invalid.length > 0) {
        return jsonError(
          req,
          `disabledPropertyIds must belong to this organization: ${invalid.join(', ')}`,
          400
        );
      }
    }

    const settings = await upsertDashboardAssistantOrgSettings({
      organizationId: ctx.org.id,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      disabledPropertyIds: isUuidArray(body.disabledPropertyIds)
        ? body.disabledPropertyIds
        : undefined,
      updatedBy: user.id,
    });

    const toggled = typeof body.enabled === 'boolean';
    await logActivity({
      action: toggled ? 'ai.assistant_toggled' : 'ai.config_changed',
      organizationId: ctx.org.id,
      scope: 'org',
      actor: buildActorContext('dashboard', { orgAccess: ctx }, req),
      targetType: 'settings',
      targetId: ctx.org.id,
      targetLabel: ctx.org.name ?? 'the organization',
      metadata: {
        state: toggled ? (body.enabled ? 'enabled' : 'disabled') : undefined,
        fields: Object.keys(body).filter((k) => k !== 'settingsVerificationToken'),
      },
    });
    return jsonSuccess(req, hostSafe(settings));
  }

  return jsonError(req, 'Method not allowed', 405);
});
