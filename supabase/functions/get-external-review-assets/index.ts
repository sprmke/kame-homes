/**
 * get-external-review-assets — GET signed/public preview URLs for an external review.
 * Auth: super admin only.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  externalReviewImageStoragePath,
  externalReviewStayPhotoStoragePath,
  normalizeExternalReviewsDraft,
  normalizeStayPhotoUrls,
} from '../_shared/propertyExternalReviews.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';
import { formatPublicUrl } from '../_shared/utils.ts';

const BUCKET = 'app-settings-assets';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function resolveSignedUrl(
  supabase: ReturnType<typeof createServiceClient>,
  storagePath: string | null,
  fallbackUrl: string | null
): Promise<string | null> {
  if (storagePath) {
    const { data, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (!signError && data?.signedUrl) {
      return formatPublicUrl(data.signedUrl);
    }
  }
  return fallbackUrl?.trim() || null;
}

serveAuthenticated('get-external-review-assets', async (req) => {
  requireHttpMethod(req, 'GET');
  await verifySuperAdminJwt(req);

  const url = new URL(req.url);
  const propertyId = url.searchParams.get('propertyId')?.trim() ?? '';
  const reviewId = url.searchParams.get('reviewId')?.trim() ?? '';
  if (!propertyId) return jsonError(req, 'propertyId is required');
  if (!reviewId) return jsonError(req, 'reviewId is required');

  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from('app_settings')
    .select('external_reviews')
    .eq('property_id', propertyId)
    .maybeSingle();

  if (error) {
    console.error('[get-external-review-assets]', error.message);
    throw new Error('Failed to load property settings');
  }
  if (!row) return jsonError(req, 'Property settings not found', 404);

  const review = normalizeExternalReviewsDraft(row.external_reviews).find(
    (item) => item.id === reviewId
  );
  if (!review) return jsonError(req, 'Review not found', 404);

  const imageUrl = await resolveSignedUrl(
    supabase,
    externalReviewImageStoragePath(review.imageUrl, propertyId, reviewId),
    review.imageUrl
  );

  const stayPhotoUrls = normalizeStayPhotoUrls(review.stayPhotoUrls);
  const resolvedStayPhotoUrls = await Promise.all(
    stayPhotoUrls.map((photoUrl, index) =>
      resolveSignedUrl(
        supabase,
        externalReviewStayPhotoStoragePath(photoUrl, propertyId, reviewId, index),
        photoUrl
      )
    )
  );

  return jsonSuccess(req, {
    propertyId,
    reviewId,
    imageUrl,
    stayPhotoUrls: resolvedStayPhotoUrls.filter((entry): entry is string => Boolean(entry)),
    review,
  });
});
