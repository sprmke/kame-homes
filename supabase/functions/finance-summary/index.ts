/**
 * finance-summary — Admin KPI aggregates for the finance dashboard.
 */

import { computeFinanceSummary } from '../_shared/financeService.ts';
import { financeDbScope, resolveFinanceAssetAccess } from '../_shared/financeAssetScope.ts';
import { parseFinanceListQueryParams } from '../_shared/financeHttp.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('finance-summary', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const asset = await resolveFinanceAssetAccess(req, 'finance:view');
  const scope = financeDbScope(asset);
  const query = parseFinanceListQueryParams(new URL(req.url));

  const data = await computeFinanceSummary({
    ...scope,
    from: query.from,
    to: query.to,
    basis: query.basis,
    includeCancelled: query.includeCancelled,
    completedOnly: query.completedOnly,
    q: query.q,
  });

  return jsonSuccess(req, data);
});
