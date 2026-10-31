/**
 * list-help-center-faqs-admin — GET all FAQ items, published or not (super admin editor).
 * Docs: docs/workflow/in-progress/help-support-center.md, Module 4.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonSuccess, requireHttpMethod, parsePageLimit } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';

serveSuperAdmin('list-help-center-faqs-admin', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const p = url.searchParams;
  const { page, limit } = parsePageLimit(p);

  const supabase = createServiceClient();
  const fromIdx = (page - 1) * limit;
  const toIdx = fromIdx + limit - 1;

  const { data, error, count } = await supabase
    .from('help_center_faqs')
    .select('*', { count: 'exact' })
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .range(fromIdx, toIdx);

  if (error) throw new Error(error.message);

  return jsonSuccess(req, { faqs: data ?? [], total: count ?? 0, page, limit });
});
