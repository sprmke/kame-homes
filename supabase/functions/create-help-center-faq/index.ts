/**
 * create-help-center-faq — POST new FAQ item (super admin).
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

serveSuperAdmin('create-help-center-faq', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  if (!category) return jsonError(req, 'category is required');

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return jsonError(req, 'question is required');

  const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
  if (!answer) return jsonError(req, 'answer is required');

  const sortOrder = typeof body.sortOrder === 'number' ? Math.round(body.sortOrder) : 0;
  const isPublished = typeof body.isPublished === 'boolean' ? body.isPublished : true;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('help_center_faqs')
    .insert({
      category,
      question,
      answer,
      sort_order: sortOrder,
      is_published: isPublished,
    })
    .select('*')
    .single();

  if (error) {
    return jsonError(req, `Failed to create FAQ: ${error.message}`, 500);
  }

  await logSuperAdminAction(user, {
    action: 'help_center.faq_created',
    targetType: 'help_center_faq',
    targetId: typeof data.id === 'string' ? data.id : null,
    summary: 'Created Help Center FAQ',
    metadata: { category },
  });

  return jsonSuccess(req, { faq: data });
});
