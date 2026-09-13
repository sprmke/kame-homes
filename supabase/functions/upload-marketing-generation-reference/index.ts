/**
 * upload-marketing-generation-reference — reference image/video library for the
 * Marketing Studio Generate tab.
 *
 * POST   multipart/form-data { file }  → stores in property-media under
 *        marketing-ai-refs/{propertyId}/ and inserts a reference row
 * GET    → lists the property's reference library (newest first, cap 50)
 * DELETE { referenceId }               → removes the object and the row
 *
 * Auth: resolveScopedPropertyAccess + requirePropertyPermissionAndFeature
 *       ('marketing.generate:add', 'aiMarketingImageGeneration').
 *
 * activity-log: N/A — a reference upload is a staging artifact for a generation, not
 * a host-meaningful action. The generation that consumes it emits
 * `marketing.image_generated` with `reference_count` in its metadata, and deleting a
 * generated asset emits `marketing.generated_asset_deleted`.
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  extensionForVisualMime,
  marketingReferenceStoragePath,
  maxReferenceBytesFor,
  readImageDimensions,
  removeGenerationObjects,
  resolveReferenceMime,
  uploadGenerationBytes,
} from '../_shared/marketingGenerationStorage.ts';
import { formatMaxBytesError } from '../_shared/uploadLimits.ts';
import { listMarketingGenerationReferences } from '../_shared/marketingGenerationJobs.ts';

const REFERENCE_COLUMNS = `
  id, organization_id, property_id, media_type, storage_path, public_url, mime_type,
  file_name, byte_size, width, height, duration_seconds, last_used_at, created_at
`;

serveAuthenticated('upload-marketing-generation-reference', async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
    return jsonError(req, 'Method not allowed', 405);
  }

  let propertyId: string;
  let organizationId: string;
  let actorUserId: string;
  try {
    const scoped = await resolveScopedPropertyAccess(req, 'marketing.generate:add');
    propertyId = scoped.property.id;
    const access = await requirePropertyPermissionAndFeature(
      req,
      propertyId,
      'marketing.generate:add',
      'aiMarketingImageGeneration'
    );
    actorUserId = access.user.id;
    organizationId = String(scoped.property.organization_id);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const sb = createServiceClient();

  if (req.method === 'GET') {
    const references = await listMarketingGenerationReferences(sb, propertyId);
    return jsonSuccess(req, { references });
  }

  const limited = await rateLimitGate(req, {
    scope: 'marketing-generation-reference',
    identity: actorUserId,
    limit: 30,
    windowSec: 300,
  });
  if (limited) return limited;

  if (req.method === 'DELETE') {
    const body = (await req.json().catch(() => ({}))) as { referenceId?: string };
    const referenceId = typeof body.referenceId === 'string' ? body.referenceId.trim() : '';
    if (!referenceId) return jsonError(req, 'referenceId is required', 400);

    const { data: row, error } = await sb
      .from('marketing_generation_references')
      .select('id, property_id, storage_path')
      .eq('id', referenceId)
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);
    if (!row || row.property_id !== propertyId) {
      return jsonError(req, 'Reference not found', 404);
    }

    await removeGenerationObjects(sb, [String(row.storage_path)]);
    const { error: deleteError } = await sb
      .from('marketing_generation_references')
      .delete()
      .eq('id', referenceId);
    if (deleteError) return jsonError(req, deleteError.message, 500);

    return jsonSuccess(req, { referenceId });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) {
    return jsonError(req, 'file is required', 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return jsonError(req, 'File is empty', 400);
  }

  let mime: string;
  let mediaType: 'image' | 'video';
  try {
    const resolved = resolveReferenceMime(bytes, file.type ?? '');
    mime = resolved.mime;
    mediaType = resolved.mediaType;
  } catch (err) {
    return jsonError(req, (err as Error).message, 400);
  }

  const maxBytes = maxReferenceBytesFor(mediaType);
  if (bytes.byteLength > maxBytes) {
    return jsonError(req, formatMaxBytesError(maxBytes), 400);
  }

  const ext = extensionForVisualMime(mime);
  const storagePath = marketingReferenceStoragePath(propertyId, crypto.randomUUID(), ext);

  let publicUrl: string;
  try {
    publicUrl = await uploadGenerationBytes(sb, storagePath, bytes, mime);
  } catch (err) {
    return jsonError(req, (err as Error).message, 502);
  }

  const dimensions = mediaType === 'image' ? readImageDimensions(bytes) : null;

  const { data: inserted, error: insertError } = await sb
    .from('marketing_generation_references')
    .insert({
      organization_id: organizationId,
      property_id: propertyId,
      media_type: mediaType,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: mime,
      file_name: file.name?.slice(0, 200) || null,
      byte_size: bytes.byteLength,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      uploaded_by: actorUserId,
    })
    .select(REFERENCE_COLUMNS)
    .single();

  if (insertError) {
    await removeGenerationObjects(sb, [storagePath]);
    return jsonError(req, insertError.message, 500);
  }

  return jsonSuccess(req, { reference: inserted });
});
