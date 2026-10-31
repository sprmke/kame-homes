/**
 * maintenance-summary — Admin KPI aggregates for the maintenance dashboard.
 */

import { computeMaintenanceSummary } from '../_shared/maintenanceService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('maintenance-summary', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const { property } = await resolveScopedPropertyAccess(req, 'maintenance:view');
  const propertyId = property.id;
  const url = new URL(req.url);
  const data = await computeMaintenanceSummary({
    propertyId,
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    includeDueInRange: url.searchParams.get('include_due_in_range') === 'true',
  });

  return jsonSuccess(req, data);
});
