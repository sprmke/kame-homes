/**
 * Saved-template thumbnails live in Storage, not inside `design_json`.
 *
 * Clients still send `designJson.thumbnailDataUrl` (a small JPEG captured at save
 * time). `marketing-templates` strips it, stores the image under
 * `{propertyId}/marketing-thumbs/`, and keeps only the object path in
 * `marketing_templates.thumbnail_path`. Template lists stop shipping base64 images.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { sniffVisualMime } from './marketingGenerationStorage.ts';
import { parseDataUrl } from './marketingMediaUpload.ts';
import { PROPERTY_MEDIA_BUCKET } from './propertyMedia.ts';
import { formatPublicUrl } from './utils.ts';

/** Thumbnails are ~20-60 KB JPEGs; anything far bigger is not a thumbnail. */
export const MAX_TEMPLATE_THUMBNAIL_BYTES = 600 * 1024;
const THUMBNAIL_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const THUMBNAIL_KEY = 'thumbnailDataUrl';

/** `designJson` without its embedded thumbnail, plus that thumbnail (if any). */
export function splitThumbnail(designJson: Record<string, unknown>): {
  designJson: Record<string, unknown>;
  dataUrl: string | null;
} {
  if (!(THUMBNAIL_KEY in designJson)) return { designJson, dataUrl: null };
  const { [THUMBNAIL_KEY]: raw, ...rest } = designJson;
  return {
    designJson: rest,
    dataUrl: typeof raw === 'string' && raw.startsWith('data:') ? raw : null,
  };
}

export function templateThumbnailPath(propertyId: string, templateId: string, ext: string): string {
  return `${propertyId}/marketing-thumbs/${templateId}-${Date.now()}${ext}`;
}

/**
 * Validates (real image bytes, size cap) and uploads a thumbnail data URL.
 * Returns the object path, or null when the data URL is not a usable image.
 */
export async function uploadTemplateThumbnail(
  sb: SupabaseClient,
  propertyId: string,
  templateId: string,
  dataUrl: string
): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed || parsed.bytes.byteLength === 0) return null;
  if (parsed.bytes.byteLength > MAX_TEMPLATE_THUMBNAIL_BYTES) return null;
  const sniffed = sniffVisualMime(parsed.bytes);
  if (!sniffed || !THUMBNAIL_MIME.has(sniffed)) return null;
  const ext = sniffed === 'image/png' ? '.png' : sniffed === 'image/webp' ? '.webp' : '.jpg';
  const path = templateThumbnailPath(propertyId, templateId, ext);
  const { error } = await sb.storage.from(PROPERTY_MEDIA_BUCKET).upload(path, parsed.bytes, {
    contentType: sniffed,
    upsert: false,
    // Paths are unique per upload, so the object never changes: cache it hard.
    cacheControl: '31536000',
  });
  if (error) throw new Error(`Thumbnail upload failed: ${error.message}`);
  return path;
}

/**
 * Copies a stored thumbnail for a duplicated row (Duplicate, Save as template) so the
 * new card has art right away. Returns the new path, or null (the card falls back).
 */
export async function copyTemplateThumbnail(
  sb: SupabaseClient,
  propertyId: string,
  templateId: string,
  sourcePath: string | null | undefined
): Promise<string | null> {
  if (!sourcePath || !sourcePath.startsWith(`${propertyId}/marketing-thumbs/`)) return null;
  const ext = sourcePath.match(/\.(jpg|png|webp)$/)?.[0] ?? '.jpg';
  const path = templateThumbnailPath(propertyId, templateId, ext);
  try {
    const { error } = await sb.storage.from(PROPERTY_MEDIA_BUCKET).copy(sourcePath, path);
    return error ? null : path;
  } catch {
    return null;
  }
}

/** Best effort: an orphaned thumbnail is harmless, a failed save is not. */
export async function removeTemplateThumbnail(
  sb: SupabaseClient,
  path: string | null | undefined
): Promise<void> {
  if (!path || !path.includes('/marketing-thumbs/')) return;
  try {
    await sb.storage.from(PROPERTY_MEDIA_BUCKET).remove([path]);
  } catch {
    // Ignore: storage cleanup must never block the request.
  }
}

export function templateThumbnailUrl(sb: SupabaseClient, path: string | null): string | null {
  if (!path) return null;
  const {
    data: { publicUrl },
  } = sb.storage.from(PROPERTY_MEDIA_BUCKET).getPublicUrl(path);
  return formatPublicUrl(publicUrl);
}
