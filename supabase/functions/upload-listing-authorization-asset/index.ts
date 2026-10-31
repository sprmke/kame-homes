/**
 * upload-listing-authorization-asset — Owner upload for per-listing authorization proofs.
 * Auth: listing owner via listingKind + listingId. Private bucket; returns a signed preview URL.
 */

import {
  LISTING_AUTHORIZATION_ASSET_TYPES,
  type ListingAuthorizationAssetType,
} from '../_shared/listingAuthorization.ts';
import { applyListingAuthorizationAssetFromBytes } from '../_shared/listingAuthorizationAssetUpload.ts';
import { parseListingKind } from '../_shared/listingAuthorizationService.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { assertWithinUploadLimit } from '../_shared/uploadLimits.ts';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

serveAuthenticated('upload-listing-authorization-asset', async (req) => {
  requireHttpMethod(req, 'POST');

  const formData = await req.formData();
  const readField = (key: string) =>
    typeof formData.get(key) === 'string' ? String(formData.get(key)).trim() : '';

  const listingKind = parseListingKind(readField('listingKind'));
  const listingId = readField('listingId');
  const assetTypeRaw = readField('assetType');
  const file = formData.get('file');

  if (!listingKind) return jsonError(req, 'listingKind must be property or parking');
  if (!listingId) return jsonError(req, 'listingId is required');
  if (!(LISTING_AUTHORIZATION_ASSET_TYPES as readonly string[]).includes(assetTypeRaw)) {
    return jsonError(req, 'Invalid assetType');
  }
  if (!(file instanceof File)) return jsonError(req, 'file is required');

  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) return jsonError(req, 'File must be JPEG, PNG, WebP, or PDF');
  assertWithinUploadLimit(file, mime === 'application/pdf' ? 'pdf' : 'document');

  const assetType = assetTypeRaw as ListingAuthorizationAssetType;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await applyListingAuthorizationAssetFromBytes({
    req,
    listingKind,
    listingId,
    assetType,
    bytes,
    mimeType: mime,
    fileName: file.name || 'proof.jpg',
  });

  return jsonSuccess(req, {
    path: result.path,
    previewUrl: result.previewUrl,
    assetType: result.assetType,
    ...result.serialized,
  });
});
