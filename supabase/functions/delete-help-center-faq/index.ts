/**
 * delete-help-center-faq — POST delete an FAQ item (super admin).
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

serveSuperAdmin('delete-help-center-faq', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return jsonError(req, 'id is required');

  const supabase = createServiceClient();
  const { error } = await supabase.from('help_center_faqs').delete().eq('id', id);
  if (error) return jsonError(req, `Failed to delete FAQ: ${error.message}`, 500);

  await logSuperAdminAction(user, {
    action: 'help_center.faq_deleted',
    targetType: 'help_center_faq',
    targetId: id,
    summary: 'Deleted Help Center FAQ',
  });

  return jsonSuccess(req, { deleted: true });
});
