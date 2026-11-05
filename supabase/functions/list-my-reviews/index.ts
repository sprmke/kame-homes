/**
 * list-my-reviews — signed-in guest Reviews page.
 * GET ?tab=to_write|by_you|about_you&cursor=
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { listMyReviews, type GuestReviewListTab } from '../_shared/guestMyReviews.ts';

const TABS = new Set<GuestReviewListTab>(['to_write', 'by_you', 'about_you']);

serveAuthenticated('list-my-reviews', async (req, user) => {
  requireHttpMethod(req, 'GET');
  const url = new URL(req.url);
  const tabRaw = (url.searchParams.get('tab') ?? 'to_write').trim() as GuestReviewListTab;
  if (!TABS.has(tabRaw)) return jsonError(req, 'Invalid tab', 400);
  const cursor = url.searchParams.get('cursor');
  const page = await listMyReviews(user, tabRaw, cursor);
  return jsonSuccess(req, page);
});
