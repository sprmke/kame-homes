/**
 * list-help-center-faqs — GET published FAQ items for the Help & Support FAQ module.
 * Auth: verifyAuthenticatedUser (any signed-in dashboard user — content isn't tenant-scoped).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('list-help-center-faqs', async (req) => {
  requireHttpMethod(req, 'GET');

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('help_center_faqs')
    .select('id, category, question, answer, sort_order, source_route_guide_path')
    .eq('is_published', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  return jsonSuccess(req, { faqs: data ?? [] });
});
