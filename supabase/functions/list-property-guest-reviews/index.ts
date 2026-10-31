/**
 * list-property-guest-reviews — GET property-scoped reviews for Marketing Studio.
 * Auth: marketing:view (no plan gate — picker is preview-open below Pro).
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import {
  listPropertyGuestReviewsForMarketing,
  type MarketingGuestReviewSource,
} from '../_shared/marketingGuestReviews.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const SOURCES = new Set<MarketingGuestReviewSource | 'all'>(['kame', 'facebook', 'airbnb', 'all']);

serveAuthenticated('list-property-guest-reviews', async (req) => {
  requireHttpMethod(req, 'GET');

  let propertyId: string;
  try {
    const ctx = await resolveScopedPropertyAccess(req, 'marketing:view');
    propertyId = ctx.property.id;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const url = new URL(req.url);
  const minRatingRaw = url.searchParams.get('minRating');
  const limitRaw = url.searchParams.get('limit');
  const sourceRaw = url.searchParams.get('source')?.trim().toLowerCase() || 'all';
  const socialSeedOnly = url.searchParams.get('socialSeedOnly') === '1';

  if (!SOURCES.has(sourceRaw as MarketingGuestReviewSource | 'all')) {
    return jsonError(req, 'Invalid source filter', 400);
  }

  const minRating = minRatingRaw != null && minRatingRaw !== '' ? Number(minRatingRaw) : undefined;
  const limit = limitRaw != null && limitRaw !== '' ? Number(limitRaw) : undefined;

  if (minRating != null && (!Number.isFinite(minRating) || minRating < 1 || minRating > 5)) {
    return jsonError(req, 'minRating must be 1–5', 400);
  }
  if (limit != null && (!Number.isFinite(limit) || limit < 1)) {
    return jsonError(req, 'limit must be a positive number', 400);
  }

  const reviews = await listPropertyGuestReviewsForMarketing(propertyId, {
    minRating,
    limit,
    source: sourceRaw as MarketingGuestReviewSource | 'all',
    socialSeedOnly,
  });

  return jsonSuccess(req, { reviews });
});
