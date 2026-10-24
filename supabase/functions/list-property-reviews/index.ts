/**
 * list-property-reviews — host Reviews page feed + KPIs.
 * Auth: reviews:view. Unpublished counterpart content is never returned.
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import {
  getPropertyReviewSummary,
  listReceivedReviews,
  listToWriteReviews,
  listWrittenReviews,
} from '../_shared/propertyReviewList.ts';
import { parseReviewListParams, parseReviewListTab } from '../_shared/reviewListParams.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('list-property-reviews', async (req) => {
  requireHttpMethod(req, 'GET');

  let propertyId: string;
  try {
    const ctx = await resolveScopedPropertyAccess(req, 'reviews:view');
    propertyId = ctx.property.id;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const url = new URL(req.url);
  const tab = parseReviewListTab(url.searchParams.get('tab'));
  if (!tab) return jsonError(req, 'Invalid tab', 400);
  const params = parseReviewListParams(url, tab);

  const [summary, page] = await Promise.all([
    getPropertyReviewSummary(propertyId),
    tab === 'received'
      ? listReceivedReviews(propertyId, params)
      : tab === 'written'
        ? listWrittenReviews(propertyId, params)
        : listToWriteReviews(propertyId, params),
  ]);

  return jsonSuccess(req, { tab, summary, ...page });
});
