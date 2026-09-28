/**
 * analytics-org-summary — Host Analytics org portfolio rollup (properties + parkings).
 * Org scope: ?org_slug=… or ?org_id=…. ?from=&to= (defaults to current calendar month, Manila).
 *
 * Preview-open: `org.analytics:view` is enough to read every active listing's numbers.
 * `analyticsInsights` gates Export CSV (client), not this GET.
 *
 * Occupancy is night-weighted across listings (sum occupied / sum available), not the mean of
 * per-listing occupancy percentages. Prior-period deltas use one bookings load per listing.
 * Computation lives in _shared/orgPortfolioSummary.ts (shared with the assistant tool).
 */

import { manilaTodayIso } from '../_shared/bookingsListSort.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import {
  computeOrgPortfolioSummary,
  defaultMonthRange,
  isValidIsoDate,
} from '../_shared/orgPortfolioSummary.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('analytics-org-summary', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const { org } = await resolveOrgAccessContext(req, 'org.analytics:view');

  const today = manilaTodayIso();
  const url = new URL(req.url);
  const defaultRange = defaultMonthRange(today);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const from = isValidIsoDate(fromParam) ? fromParam : defaultRange.from;
  const to = isValidIsoDate(toParam) ? toParam : defaultRange.to;
  if (from > to) {
    return jsonError(req, '`from` must be on or before `to`', 400);
  }

  return jsonSuccess(req, await computeOrgPortfolioSummary(org.id, from, to));
});
