/**
 * list-org-reviews — org Reviews rollup (KPIs, per-property table, review feed).
 * Auth: org.reviews:view. Published guest reviews only, limited to the caller's
 * visible properties (org members without all-listings access see their
 * assigned listings only).
 *
 * Row actions are per listing: the response carries `canRespond` / `canWrite`
 * resolved from the caller's own `reviews.responses:edit` / `reviews.guests:edit`
 * on each property. The action endpoints re-check it — this only hides controls
 * the caller cannot use.
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import {
  resolveAssignedListingIdsForOrgUser,
  resolvePropertyIdsWithPermissionForOrgUser,
} from '../_shared/orgAuth.ts';
import {
  getOrgReviewSummary,
  listOrgReceivedReviews,
  listOrgReviewScopeProperties,
  listOrgToWriteReviews,
  listOrgWrittenReviews,
  type OrgReviewActionScope,
} from '../_shared/orgReviewList.ts';
import { parseReviewListParams, parseReviewListTab } from '../_shared/reviewListParams.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `?properties=<uuid>,<uuid>` from the listing filter; `property_id` stays supported. */
function readPropertyFilter(url: URL): string[] | null {
  const raw = [
    ...(url.searchParams.get('properties') ?? '').split(','),
    url.searchParams.get('property_id') ?? '',
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  if (raw.length === 0) return null;
  if (raw.some((value) => !UUID_RE.test(value))) return null;
  return [...new Set(raw)];
}

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
  if (
    (url.searchParams.get('properties') || url.searchParams.get('property_id')) &&
    readPropertyFilter(url) === null
  ) {
    return jsonError(req, 'Invalid property filter', 400);
  }
  // `tab=properties` is the By-property rollup: KPIs and the listing table only,
  // so it skips the feed query entirely.
  const tabRaw = url.searchParams.get('tab');
  const listingsOnly = tabRaw === 'properties';
  const tab = listingsOnly ? 'received' : parseReviewListTab(tabRaw);
  if (!tab) return jsonError(req, 'Invalid tab', 400);
  const params = parseReviewListParams(url, tab);
  const propertyFilter = readPropertyFilter(url);

  const assignedPropertyIds = ctx.canListAllProperties
    ? null
    : (await resolveAssignedListingIdsForOrgUser(ctx.user.id, ctx.org.id)).propertyIds;
  const properties = await listOrgReviewScopeProperties({
    organizationId: ctx.org.id,
    assignedPropertyIds,
  });

  // KPIs and the By-property table always cover every visible listing; only the
  // feed narrows, so the filter reads as "which listings am I looking at".
  const feedProperties = propertyFilter
    ? properties.filter((property) => propertyFilter.includes(property.id))
    : properties;

  if (listingsOnly) {
    const summary = await getOrgReviewSummary(properties);
    return jsonSuccess(req, { tab: 'properties', summary, items: [], total: 0 });
  }

  const visibleIds = properties.map((property) => property.id);
  const actions: OrgReviewActionScope = ctx.canListAllProperties
    ? { respond: new Set(visibleIds), writeGuest: new Set(visibleIds) }
    : await (async () => {
        const [respond, writeGuest] = await Promise.all([
          resolvePropertyIdsWithPermissionForOrgUser(
            ctx.user.id,
            ctx.org.id,
            'reviews.responses:edit'
          ),
          resolvePropertyIdsWithPermissionForOrgUser(
            ctx.user.id,
            ctx.org.id,
            'reviews.guests:edit'
          ),
        ]);
        return { respond: new Set(respond), writeGuest: new Set(writeGuest) };
      })();

  const [summary, page] = await Promise.all([
    getOrgReviewSummary(properties),
    tab === 'received'
      ? listOrgReceivedReviews(ctx.org.id, feedProperties, params, actions)
      : tab === 'written'
        ? listOrgWrittenReviews(feedProperties, params)
        : listOrgToWriteReviews(feedProperties, params, actions),
  ]);

  return jsonSuccess(req, { tab, summary, ...page });
});
