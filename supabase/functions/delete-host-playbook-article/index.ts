/**
 * delete-host-playbook-article — POST delete a Playbook article (super admin).
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

serveSuperAdmin('delete-host-playbook-article', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return jsonError(req, 'id is required');

  const supabase = createServiceClient();
  const { error } = await supabase.from('host_playbook_articles').delete().eq('id', id);
  if (error) return jsonError(req, `Failed to delete article: ${error.message}`, 500);

  await logSuperAdminAction(user, {
    action: 'host_playbook.article_deleted',
    targetType: 'host_playbook_article',
    targetId: id,
    summary: 'Deleted host playbook article',
  });

  return jsonSuccess(req, { deleted: true });
});
