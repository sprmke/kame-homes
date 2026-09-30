/**
 * dashboard-assistant-briefing — read-only "needs attention" cards for the AI mode home.
 * Deterministic (no LLM call, no credits): reuses the cached dashboard-stats aggregates.
 *
 * GET ?org_slug=… | ?property_id=… | ?parking_id=…
 *
 * Same RBAC as dashboard-stats (_shared/dashboardStatsScope.ts; the most specific scope wins). Returns an empty card list
 * (not an error) when the assistant is off for the org, so the home still renders.
 * Docs: docs/workflow/in-progress/ai-chat-mode.md (Phase 5).
 */

import { buildBriefingCards } from '../_shared/dashboardAssistantBriefing.ts';
import {
  getDashboardAssistantGlobalSettings,
  getDashboardAssistantOrgSettings,
  isDashboardAssistantAccessible,
} from '../_shared/dashboardAssistantSettings.ts';
import {
  readDashboardStatsCached,
  resolveDashboardStatsScope,
} from '../_shared/dashboardStatsScope.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('dashboard-assistant-briefing', async (req) => {
  if (req.method !== 'GET') return jsonError(req, 'Method not allowed', 405);

  const url = new URL(req.url);
  // Scope RBAC first (property / parking team / org leaf) — the same checks as dashboard-stats,
  // so parking-only and property-only team members get their own briefing.
  const scope = await resolveDashboardStatsScope(req, url);
  if (!scope) return jsonError(req, 'org_slug, property_id or parking_id is required', 400);

  const [globalSettings, orgSettings] = await Promise.all([
    getDashboardAssistantGlobalSettings(),
    getDashboardAssistantOrgSettings(scope.organizationId),
  ]);
  if (!isDashboardAssistantAccessible(globalSettings, orgSettings, scope.propertyId ?? null)) {
    return jsonSuccess(req, { cards: [], manilaDate: null });
  }

  const stats = await readDashboardStatsCached(scope, { from: null, to: null });
  return jsonSuccess(req, {
    cards: buildBriefingCards(stats.attention),
    manilaDate: stats.manilaDate,
  });
});
