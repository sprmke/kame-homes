/**
 * get-residence-unit-types — Public GET unit type catalog for a development/residence name.
 * Query: ?residenceName=Azure North Residences
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccessWithETag } from '../_shared/httpResponse.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { mergeUnitTypes } from '../_shared/unitTypes.ts';

servePublic('get-residence-unit-types', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  const limited = await publicGetRateLimitGate(req, 'get-residence-unit-types');
  if (limited) return limited;

  const url = new URL(req.url);
  const residenceName = url.searchParams.get('residenceName')?.trim() ?? '';
  if (!residenceName) {
    return jsonError(req, 'residenceName is required', 400);
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('developments')
    .select('settings')
    .eq('name', residenceName)
    .maybeSingle();

  if (error) {
    console.error('[get-residence-unit-types]', error.message);
    throw new Error('Failed to load unit types');
  }

  const settings =
    data?.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
      ? (data.settings as Record<string, unknown>)
      : {};

  const unitTypes = mergeUnitTypes(settings.unitTypes, residenceName);
  // Unit type vocabulary — changes only on a super-admin development edit.
  return jsonSuccessWithETag(req, { unitTypes }, 'publicStatic');
});
