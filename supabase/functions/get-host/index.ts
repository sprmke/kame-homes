/**
 * get-host — GET one org owner profile + stats (super admin).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { loadHostSummary } from '../_shared/hostSerialize.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

serveAuthenticated('get-host', async (req) => {
  requireHttpMethod(req, 'GET');
  await verifySuperAdminJwt(req);

  const url = new URL(req.url);
  const hostId = url.searchParams.get('hostId')?.trim() ?? '';
  if (!hostId) {
    return jsonError(req, 'hostId is required');
  }

  const supabase = createServiceClient();
  const { data: ownedOrg, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', hostId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[get-host]', error.message);
    throw new Error('Failed to load host');
  }

  if (!ownedOrg) {
    return jsonError(req, 'Host not found', 404);
  }

  const host = await loadHostSummary(supabase, hostId);
  return jsonSuccess(req, { host });
});
