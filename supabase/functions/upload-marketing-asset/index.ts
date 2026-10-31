/**
 * upload-marketing-asset — persistent storage for Design canvas uploads (collage
 * cell photos, and anything dropped through Polotno's own Upload panel).
 *
 * Fixes the upload-persistence bug: the canvas previously used
 * `URL.createObjectURL(file)` for every upload, and autosave wrote that dead
 * `blob:` URL straight into `design_json.polotno` — gone on the next page load.
 * This uploads the bytes to Storage and returns a real https URL instead.
 *
 * POST multipart/form-data { file } → { url, storagePath, width, height }
 *
 * Auth: resolveScopedPropertyAccess + requirePropertyPermissionAndFeature
 *       ('marketing.templates:add', 'marketingStudio').
 * Storage: property-media bucket, marketing-uploads/{propertyId}/{uuid}{ext} — a
 *          dedicated prefix (not the property gallery, not the 90-day-pruned
 *          generation-reference prefix) so a canvas asset never leaks onto the
 *          public listing page and never expires out from under a saved design.
 *
 * activity-log: N/A — a canvas asset upload is a staging artifact for a design,
 * not a host-meaningful action by itself; the template save that follows already
 * flows through the existing marketing_templates save path.
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import {
  classifyGenerationReferenceMime,
  extensionForVisualMime,
  marketingUploadStoragePath,
  readImageDimensions,
  sniffVisualMime,
  uploadGenerationBytes,
} from '../_shared/marketingGenerationStorage.ts';
import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { formatMaxBytesError, UPLOAD_MAX_BYTES } from '../_shared/uploadLimits.ts';

serveAuthenticated('upload-marketing-asset', async (req) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  let propertyId: string;
  let actorUserId: string;
  try {
    const scoped = await resolveScopedPropertyAccess(req, 'marketing.templates:add');
    propertyId = scoped.property.id;
    const access = await requirePropertyPermissionAndFeature(
      req,
      propertyId,
      'marketing.templates:add',
      'marketingStudio'
    );
    actorUserId = access.user.id;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const limited = await rateLimitGate(req, {
    scope: 'marketing-asset-upload',
    identity: actorUserId,
    limit: 60,
    windowSec: 300,
  });
  if (limited) return limited;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) {
    return jsonError(req, 'file is required', 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return jsonError(req, 'File is empty', 400);
  }

  const sniffed = sniffVisualMime(bytes);
  const mediaType = sniffed ? classifyGenerationReferenceMime(sniffed) : null;
  if (!sniffed || mediaType !== 'image') {
    return jsonError(req, 'File must be a JPEG, PNG, WebP, HEIC, or HEIF image', 400);
  }

  if (bytes.byteLength > UPLOAD_MAX_BYTES.image) {
    return jsonError(req, formatMaxBytesError(UPLOAD_MAX_BYTES.image), 400);
  }

  const sb = createServiceClient();
  const ext = extensionForVisualMime(sniffed);
  const storagePath = marketingUploadStoragePath(propertyId, crypto.randomUUID(), ext);

  let publicUrl: string;
  try {
    publicUrl = await uploadGenerationBytes(sb, storagePath, bytes, sniffed);
  } catch (err) {
    return jsonError(req, (err as Error).message, 502);
  }

  const dimensions = readImageDimensions(bytes);

  return jsonSuccess(req, {
    url: publicUrl,
    storagePath,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  });
});
