/**
 * delete-development — DELETE platform development (super admin).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

serveAuthenticated('delete-development', async (req) => {
  requireHttpMethod(req, 'POST');
  await verifySuperAdminJwt(req);

  const body = await readJsonBody(req);
  const developmentId = typeof body.developmentId === 'string' ? body.developmentId.trim() : '';
  if (!developmentId) {
    return jsonError(req, 'developmentId is required');
  }

  const supabase = createServiceClient();
  const { data: existing, error: loadError } = await supabase
    .from('developments')
    .select('id, name')
    .eq('id', developmentId)
    .maybeSingle();

  if (loadError) {
    console.error('[delete-development]', loadError.message);
    throw new Error('Failed to load development');
  }
  if (!existing) {
    return jsonError(req, 'Development not found', 404);
  }

  const name = existing.name as string;

  const [{ count: propertyCount }, { count: parkingCount }] = await Promise.all([
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('residence_name', name),
    supabase
      .from('parkings')
      .select('id', { count: 'exact', head: true })
      .eq('residence_name', name),
  ]);

  if ((propertyCount ?? 0) > 0 || (parkingCount ?? 0) > 0) {
    return jsonError(
      req,
      'Cannot delete a development that still has linked properties or parking slots',
      409
    );
  }

  const { error } = await supabase.from('developments').delete().eq('id', developmentId);
  if (error) {
    console.error('[delete-development]', error.message);
    throw new Error('Failed to delete development');
  }

  return jsonSuccess(req, { deleted: true });
});
