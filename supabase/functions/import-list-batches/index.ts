/**
 * import-list-batches — List import batches for a property (history page).
 * GET ?property_id=<id>&limit=<n>&page=<n>
 * Auth: resolveImportAccess.
 */

import { resolveImportAccess } from '../_shared/importAccess.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

serveAuthenticated('import-list-batches', async (req) => {
  requireHttpMethod(req, 'GET');

  const access = await resolveImportAccess(req);
  const url = new URL(req.url);

  const rawLimit = parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
  const offset = (page - 1) * limit;

  const supabase = createServiceClient();

  const {
    data: batches,
    error,
    count,
  } = await supabase
    .from('import_batches')
    .select(
      'id, status, original_file_name, row_count, created_by, created_at, updated_at, column_mapping',
      { count: 'exact' }
    )
    .eq('organization_id', access.orgId)
    .eq('property_id', access.propertyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[import-list-batches] query failed:', error.message);
    return jsonError(req, 'Failed to load import history');
  }

  return jsonSuccess(req, {
    batches: batches ?? [],
    total: count ?? 0,
    page,
    limit,
  });
});
