/**
 * get-development — GET one development by slug (super admin).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  developmentStatsByName,
  serializeDevelopment,
  type DevelopmentRow,
} from '../_shared/developmentSerialize.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

serveAuthenticated('get-development', async (req) => {
  requireHttpMethod(req, 'GET');

  await verifySuperAdminJwt(req);

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug')?.trim() ?? '';
  if (!slug) {
    return jsonError(req, 'slug is required');
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('developments')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[get-development]', error.message);
    throw new Error('Failed to load development');
  }

  if (!data) {
    return jsonError(req, 'Development not found', 404);
  }

  const row = data as DevelopmentRow;
  const statsMap = await developmentStatsByName(supabase, [row.name]);

  return jsonSuccess(req, {
    development: serializeDevelopment(
      row,
      statsMap.get(row.name) ?? { propertyCount: 0, parkingCount: 0 }
    ),
  });
});
