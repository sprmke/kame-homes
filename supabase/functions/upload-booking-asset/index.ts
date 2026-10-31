/**
 * upload-booking-asset — Admin endpoint to upload supporting assets (parking
 * endorsements, manually-obtained approved GAF PDFs, etc.) to Supabase Storage.
 *
 * Expects multipart/form-data with:
 *   bookingId   — string (UUID)
 *   assetType   — see BOOKING_ASSET_CONFIG in `_shared/bookingAssetUpload.ts`
 *   file        — the file to upload
 *   fileName    — original filename
 *
 * On success, writes the storage URL into the appropriate DB column and returns it.
 *
 * Trigger:  POST /functions/v1/upload-booking-asset
 * Auth:     verify_jwt = true (admin only)
 * Plan:     docs/planning/NEW_FLOW_PLAN.md §3.3, §6.1 Q4.4
 */

import {
  applyBookingAssetFromBytes,
  bookingAssetPermission,
  isBookingAssetType,
} from '../_shared/bookingAssetUpload.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('upload-booking-asset', async (req, user) => {
  requireHttpMethod(req, 'POST');

  const limited = await rateLimitGate(req, {
    scope: 'upload-booking-asset',
    identity: identityFromRequest(req, user),
    limit: 30,
    windowSec: 3600,
  });
  if (limited) return limited;

  const formData = await req.formData();
  const bookingId = formData.get('bookingId') as string;
  const assetTypeRaw = formData.get('assetType');
  const file = formData.get('file') as File;
  const fileName = (formData.get('fileName') as string) || file?.name;

  if (!isBookingAssetType(assetTypeRaw)) {
    throw new Error(`Invalid assetType: "${String(assetTypeRaw)}"`);
  }
  const assetType = assetTypeRaw;

  const { property } = await resolveScopedPropertyAccess(req, bookingAssetPermission(assetType));
  const propertyId = property.id;

  if (!bookingId) throw new Error('bookingId is required');
  await verifyBookingBelongsToProperty(bookingId, propertyId);
  if (!file) throw new Error('file is required');
  if (!fileName) throw new Error('fileName is required');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await applyBookingAssetFromBytes({
    bookingId,
    propertyId,
    assetType,
    fileName,
    mimeType: file.type || 'application/octet-stream',
    bytes,
    actorUserId: user.id,
    logPrefix: '[upload-booking-asset]',
  });

  return jsonSuccess(req, {
    url: result.url,
    bucket: result.bucket,
    path: result.path,
    column: result.column,
    receiptValidation: result.receiptValidation,
  });
});
