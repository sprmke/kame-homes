/**
 * get-listing-authorization-assets — GET signed preview URLs for one listing's authorization docs.
 * Auth: super admin OR listing owner. Signed URLs are otherwise only returned at upload time.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { LISTING_AUTHORIZATION_BUCKET } from '../_shared/listingAuthorization.ts';
import {
  parseListingKind,
  serializeListingAuthorization,
  verifyListingReviewerOrOwner,
} from '../_shared/listingAuthorizationService.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { formatPublicUrl } from '../_shared/utils.ts';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function signPath(
  supabase: ReturnType<typeof createServiceClient>,
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(LISTING_AUTHORIZATION_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error('[get-listing-authorization-assets] signed url', error.message);
    return null;
  }
  if (!data?.signedUrl) return null;
  // Kong-internal hosts only — do NOT rewrite to PUBLIC_API_URL/ngrok (breaks <img>/<iframe>).
  return formatPublicUrl(data.signedUrl);
}

serveAuthenticated('get-listing-authorization-assets', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const listingKind = parseListingKind(url.searchParams.get('listingKind'));
  const listingId = url.searchParams.get('listingId')?.trim() ?? '';
  if (!listingKind) return jsonError(req, 'listingKind must be property or parking');
  if (!listingId) return jsonError(req, 'listingId is required');

  const context = await verifyListingReviewerOrOwner(req, listingKind, listingId);
  const supabase = createServiceClient();
  const { assets } = context.authorization;

  const [proofUrl, additionalProofUrl, azurePmoConfirmationUrl] = await Promise.all([
    signPath(supabase, assets.proofPath),
    signPath(supabase, assets.additionalProofPath),
    signPath(supabase, assets.azurePmoConfirmationPath),
  ]);

  return jsonSuccess(req, {
    ...serializeListingAuthorization(context, context.authorization),
    organization: { id: context.org.id, name: context.org.name, slug: context.org.slug },
    assetUrls: { proofUrl, additionalProofUrl, azurePmoConfirmationUrl },
  });
});
