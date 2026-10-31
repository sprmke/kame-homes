/**
 * finance-bookings — Paginated stays ledger with computed financial columns.
 */

import { listFinanceBookings } from '../_shared/financeService.ts';
import { parseFinanceBookingsSort, parseFinanceListQueryParams } from '../_shared/financeHttp.ts';
import { jsonError, jsonResponse, parsePageLimit } from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('finance-bookings', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const { property } = await resolveScopedPropertyAccess(req, 'finance:view');
  const propertyId = property.id;
  const url = new URL(req.url);
  const p = url.searchParams;
  const { page, limit } = parsePageLimit(p);
  const query = parseFinanceListQueryParams(url);

  const { rows, total } = await listFinanceBookings({
    propertyId,
    from: query.from,
    to: query.to,
    basis: query.basis,
    includeCancelled: query.includeCancelled,
    completedOnly: query.completedOnly,
    q: query.q,
    page,
    limit,
    sort: parseFinanceBookingsSort(p.get('sort')),
  });

  return jsonResponse(req, { success: true, data: rows, total, page, limit });
});
