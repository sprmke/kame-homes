/**
 * update-host-playbook-article — POST partial update (super admin). Also used for
 * reordering (sortOrder) and the active-toggle (isActive).
 * Host Analytics module Phase 4 CRUD. Plan: docs/workflow/in-progress/host-analytics-module.md
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';

serveSuperAdmin('update-host-playbook-article', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return jsonError(req, 'id is required');

  const updates: Record<string, unknown> = {};
  if (typeof body.category === 'string' && body.category.trim()) {
    updates.category = body.category.trim();
  }
  if (typeof body.title === 'string' && body.title.trim()) {
    updates.title = body.title.trim();
  }
  if (typeof body.bodyMd === 'string' && body.bodyMd.trim()) {
    updates.body_md = body.bodyMd.trim();
  }
  if (body.appliesWhen !== undefined) {
    if (typeof body.appliesWhen !== 'object' || body.appliesWhen === null) {
      return jsonError(req, 'appliesWhen must be a JSON object');
    }
    updates.applies_when = body.appliesWhen;
  }
  if (typeof body.sortOrder === 'number') {
    updates.sort_order = Math.round(body.sortOrder);
  }
  if (typeof body.isActive === 'boolean') {
    updates.is_active = body.isActive;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError(req, 'No fields to update');
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('host_playbook_articles')
    .update(updates)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return jsonError(req, `Failed to update article: ${error.message}`, 500);
  if (!data) return jsonError(req, 'Article not found', 404);

  await logSuperAdminAction(user, {
    action: 'host_playbook.article_updated',
    targetType: 'host_playbook_article',
    targetId: id,
    summary: 'Updated host playbook article',
    metadata: { fields: Object.keys(updates) },
  });

  return jsonSuccess(req, { article: data });
});
