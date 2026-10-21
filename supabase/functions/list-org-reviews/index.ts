/**
 * list-org-reviews — org Reviews rollup (KPIs, per-property table, received feed).
 * Auth: org.reviews:view. Published guest reviews only, limited to the caller's
 * visible properties (org members without all-listings access see their
 * assigned listings only).
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { resolveAssignedListingIdsForOrgUser } from '../_shared/orgAuth.ts';
import {
  getOrgReviewSummary,
  listOrgReceivedReviews,
  listOrgReviewScopeProperties,
} from '../_shared/orgReviewList.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serveAuthenticated('list-org-reviews', async (req) => {
  requireHttpMethod(req, 'GET');

  let ctx;
  try {
    ctx = await resolveOrgAccessContext(req, 'org.reviews:view');
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const url = new URL(req.url);
  const propertyRaw = (url.searchParams.get('property_id') ?? '').trim();
  if (propertyRaw && !UUID_RE.test(propertyRaw)) {
    return jsonError(req, 'Invalid property_id', 400);
  }
  const cursor = url.searchParams.get('cursor');

  const assignedPropertyIds = ctx.canListAllProperties
    ? null
    : (await resolveAssignedListingIdsForOrgUser(ctx.user.id, ctx.org.id)).propertyIds;
  const properties = await listOrgReviewScopeProperties({
    organizationId: ctx.org.id,
    assignedPropertyIds,
  });
  const visibleIds = properties.map((property) => property.id);
  const feedIds = propertyRaw ? visibleIds.filter((id) => id === propertyRaw) : visibleIds;

  const [summary, page] = await Promise.all([
    getOrgReviewSummary(properties),
    listOrgReceivedReviews(ctx.org.id, feedIds, cursor),
  ]);

  return jsonSuccess(req, { summary, ...page });
});
