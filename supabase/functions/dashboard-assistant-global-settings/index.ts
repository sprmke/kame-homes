/**
 * dashboard-assistant-global-settings — Super-admin GET/PATCH for the platform-wide AI dashboard
 * assistant kill switch. Independent of ai-platform-global-settings (Phase A) — see
 * docs/workflow/planned/ai-dashboard-assistant.md §6.
 */

import {
  getDashboardAssistantGlobalSettings,
  setDashboardAssistantGlobalSettings,
} from '../_shared/dashboardAssistantSettings.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';

serveSuperAdmin('dashboard-assistant-global-settings', async (req, user) => {
  const stepUp = await requireSuperAdminStepUp(req, user, 'dashboard_assistant_global_settings');
  if (stepUp) return stepUp;

  if (req.method === 'GET') {
    const settings = await getDashboardAssistantGlobalSettings();
    return jsonSuccess(req, settings);
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
      return jsonError(req, 'enabled must be a boolean when provided', 400);
    }
    const settings = await setDashboardAssistantGlobalSettings({
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      updatedBy: user.id,
    });
    await logSuperAdminAction(user, {
      action: 'platform.dashboard_assistant_settings_update',
      targetType: 'platform',
      targetId: 'dashboard_assistant_global_settings',
      summary: 'Updated dashboard assistant kill switch',
      metadata: { enabled: settings.enabled },
    });
    return jsonSuccess(req, settings);
  }

  return jsonError(req, 'Method not allowed', 405);
});
