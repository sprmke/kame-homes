/**
 * dashboard-assistant-memory — what the AI assistant remembers for this host + org.
 * Docs: docs/workflow/in-progress/ai-chat-mode.md (Phase 6).
 *
 * GET    ?org_slug=                     → { preferences, houseStyle, canManageHouseStyle }
 * POST   ?org_slug= { kind, content }   → add ('preference' for yourself; 'house_style' needs
 *                                          org.settings.aiAssistant:edit)
 * DELETE ?org_slug=&id=                 → remove (own preference, or house style when allowed)
 *
 * activity-log: preferences are N/A (private to the host); house style changes log
 * `ai.config_changed` because they change every member's assistant.
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  addAssistantMemory,
  deleteAssistantMemory,
  listAssistantMemories,
  MemoryError,
  type MemoryKind,
} from '../_shared/dashboardAssistantMemory.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { hasOrgPermission } from '../_shared/orgTeamPermissions.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('dashboard-assistant-memory', async (req, user) => {
  const ctx = await resolveOrgAccessContext(req);
  const canManageHouseStyle =
    ctx.accessKind === 'owner' ||
    ctx.accessKind === 'platform_admin' ||
    hasOrgPermission(ctx.permissions, 'org.settings.aiAssistant:edit');

  try {
    if (req.method === 'GET') {
      const memory = await listAssistantMemories(ctx.org.id, user.id);
      return jsonSuccess(req, { ...memory, canManageHouseStyle });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (body.kind !== 'preference' && body.kind !== 'house_style') {
        return jsonError(req, "kind must be 'preference' or 'house_style'", 400);
      }
      const kind: MemoryKind = body.kind;
      if (kind === 'house_style' && !canManageHouseStyle) {
        return jsonError(req, 'Only admins can change the house style', 403);
      }
      const memory = await addAssistantMemory({
        organizationId: ctx.org.id,
        userId: user.id,
        kind,
        content: body.content as string,
      });
      if (kind === 'house_style') {
        await logActivity({
          action: 'ai.config_changed',
          organizationId: ctx.org.id,
          scope: 'org',
          actor: buildActorContext('dashboard', { orgAccess: ctx }, req),
          targetType: 'settings',
          targetId: ctx.org.id,
          targetLabel: 'AI assistant house style',
          metadata: { fields: ['house_style'], operation: 'added' },
        });
      }
      return jsonSuccess(req, { memory });
    }

    if (req.method === 'DELETE') {
      const id = new URL(req.url).searchParams.get('id')?.trim();
      if (!id) return jsonError(req, 'id is required', 400);
      const deletedKind = await deleteAssistantMemory({
        organizationId: ctx.org.id,
        userId: user.id,
        id,
        canManageHouseStyle,
      });
      if (deletedKind === 'house_style') {
        await logActivity({
          action: 'ai.config_changed',
          organizationId: ctx.org.id,
          scope: 'org',
          actor: buildActorContext('dashboard', { orgAccess: ctx }, req),
          targetType: 'settings',
          targetId: ctx.org.id,
          targetLabel: 'AI assistant house style',
          metadata: { fields: ['house_style'], operation: 'removed' },
        });
      }
      return jsonSuccess(req, { deleted: true });
    }
  } catch (err) {
    if (err instanceof MemoryError) return jsonError(req, err.message, err.status);
    throw err;
  }

  return jsonError(req, 'Method not allowed', 405);
});
