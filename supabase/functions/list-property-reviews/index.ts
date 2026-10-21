/**
 * list-property-reviews — host Reviews page feed + KPIs.
 * Auth: reviews:view. Unpublished counterpart content is never returned.
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  getPropertyReviewSummary,
  listReceivedReviews,
  listToWriteReviews,
  listWrittenReviews,
  type ReviewListTab,
} from '../_shared/propertyReviewList.ts';

const TABS = new Set<ReviewListTab>(['received', 'written', 'to_write']);

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
  const tabRaw = (url.searchParams.get('tab') ?? 'received').trim() as ReviewListTab;
  if (!TABS.has(tabRaw)) return jsonError(req, 'Invalid tab', 400);
  const cursor = url.searchParams.get('cursor');

  const [summary, page] = await Promise.all([
    getPropertyReviewSummary(propertyId),
    tabRaw === 'received'
      ? listReceivedReviews(propertyId, cursor)
      : tabRaw === 'written'
        ? listWrittenReviews(propertyId, cursor)
        : listToWriteReviews(propertyId, cursor),
  ]);

  return jsonSuccess(req, { tab: tabRaw, summary, ...page });
});
