/**
 * update-help-center-faq — POST partial update (super admin). Also used for
 * reordering (sortOrder) and the publish-toggle (isPublished).
 * Docs: docs/workflow/in-progress/help-support-center.md, Module 4.
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

serveSuperAdmin('update-help-center-faq', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return jsonError(req, 'id is required');

  const updates: Record<string, unknown> = {};
  if (typeof body.category === 'string' && body.category.trim()) {
    updates.category = body.category.trim();
  }
  if (typeof body.question === 'string' && body.question.trim()) {
    updates.question = body.question.trim();
  }
  if (typeof body.answer === 'string' && body.answer.trim()) {
    updates.answer = body.answer.trim();
  }
  if (typeof body.sortOrder === 'number') {
    updates.sort_order = Math.round(body.sortOrder);
  }
  if (typeof body.isPublished === 'boolean') {
    updates.is_published = body.isPublished;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError(req, 'No fields to update');
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('help_center_faqs')
    .update(updates)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return jsonError(req, `Failed to update FAQ: ${error.message}`, 500);
  if (!data) return jsonError(req, 'FAQ not found', 404);

  await logSuperAdminAction(user, {
    action: 'help_center.faq_updated',
    targetType: 'help_center_faq',
    targetId: id,
    summary: 'Updated Help Center FAQ',
    metadata: { fields: Object.keys(updates) },
  });

  return jsonSuccess(req, { faq: data });
});
