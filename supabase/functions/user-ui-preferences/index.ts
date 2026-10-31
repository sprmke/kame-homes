/**
 * user-ui-preferences — GET / PATCH the signed-in user's own dashboard UI preferences
 * (currently `dashboardMode`: 'advanced' | 'ai'). Per-user, never org-scoped; no RBAC beyond
 * the JWT because a user can only ever read or write their own row.
 * Docs: docs/workflow/in-progress/ai-chat-mode.md (Phase 2).
 *
 * activity-log: N/A — personal UI preference, no org / property / parking state changes.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  mapUserUiPreferencesRow,
  parseUserUiPreferencesPatch,
} from '../_shared/userUiPreferences.ts';

serveAuthenticated('user-ui-preferences', async (req, user) => {
  const sb = createServiceClient();

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('user_ui_preferences')
      .select('dashboard_mode, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return jsonError(req, `Failed to load preferences: ${error.message}`, 500);
    return jsonSuccess(req, mapUserUiPreferencesRow(data));
  }

  if (req.method === 'PATCH') {
    const parsed = parseUserUiPreferencesPatch(await readJsonBody(req));
    if (!parsed.ok) return jsonError(req, parsed.error, 400);

    const { data, error } = await sb
      .from('user_ui_preferences')
      .upsert(
        {
          user_id: user.id,
          dashboard_mode: parsed.patch.dashboardMode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('dashboard_mode, updated_at')
      .single();
    if (error) return jsonError(req, `Failed to save preferences: ${error.message}`, 500);
    return jsonSuccess(req, mapUserUiPreferencesRow(data));
  }

  return jsonError(req, 'Method not allowed', 405);
});
