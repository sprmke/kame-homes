/**
 * cancellation-policy-impact — how many live bookings keep their existing policy.
 *
 * GET ?property_id=<uuid> → { upcomingCount, versionId }
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { readCancellationPolicyVersionId } from '../_shared/cancellationPolicy.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { readPropertyIdFromUrl, resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const LIVE_STATUSES = [
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
];

serveAuthenticated('cancellation-policy-impact', async (req) => {
  requireHttpMethod(req, 'GET');
  const url = new URL(req.url);
  const propertyId = readPropertyIdFromUrl(url);
  if (!propertyId) return jsonError(req, 'property_id is required');

  const { property } = await resolveScopedPropertyAccess(req, 'settings:view', propertyId);
  const sb = createServiceClient();
  const [{ count }, { data }] = await Promise.all([
    sb
      .from('guest_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', property.id)
      .is('parking_id', null)
      .in('status', LIVE_STATUSES),
    sb.from('properties').select('settings').eq('id', property.id).maybeSingle(),
  ]);

  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  return jsonSuccess(req, {
    upcomingCount: count ?? 0,
    versionId: readCancellationPolicyVersionId(settings),
  });
});
