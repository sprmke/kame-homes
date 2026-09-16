/**
 * Storage + media sniffing for Marketing Studio AI asset generation.
 *
 * Two prefixes inside the existing public `property-media` bucket — no new bucket,
 * no config.toml change:
 *   marketing-ai-refs/{propertyId}/{uuid}{ext}  uploaded references, pruned at 90 days
 *   marketing-ai/{propertyId}/{jobId}{ext}      generated outputs, never auto-pruned
 *
 * Outputs are keyed by job id so a retried finalize overwrites rather than
 * duplicating — the upload step is idempotent by construction.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { PROPERTY_MEDIA_BUCKET } from './propertyMedia.ts';
import { UPLOAD_MAX_BYTES } from './uploadLimits.ts';
import { formatPublicUrl } from './utils.ts';

export type VisualMediaType = 'image' | 'video';

/** What Gemini / Veo accept as inline reference data. Narrower than the bucket allows. */
export const GENERATION_REFERENCE_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const GENERATION_REFERENCE_VIDEO_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export function classifyGenerationReferenceMime(mime: string): VisualMediaType | null {
  const normalized = normalizeMime(mime);
  if (GENERATION_REFERENCE_IMAGE_MIME.has(normalized)) return 'image';
  if (GENERATION_REFERENCE_VIDEO_MIME.has(normalized)) return 'video';
  return null;
}

function normalizeMime(mime: string): string {
  return mime.split(';')[0]?.trim().toLowerCase() ?? '';
}

/**
 * Magic-byte sniff for the containers we accept, so a renamed `.jpg` that is really
 * an executable is rejected before it reaches a public bucket. Same shape as
 * `sniffAudioMime` in marketingMusicStorage.ts.
 */
export function sniffVisualMime(bytes: Uint8Array): string | null {
  if (bytes.byteLength < 12) return null;

  // JPEG — FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';

  // PNG — 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // RIFF container — WEBP at offset 8
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // ISO base media (ftyp at offset 4) — MP4 / MOV / HEIC all share it, so the brand decides.
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!).toLowerCase();
    if (brand.startsWith('qt')) return 'video/quicktime';
    if (brand.startsWith('heic') || brand.startsWith('heix') || brand.startsWith('mif1')) {
      return 'image/heic';
    }
    if (brand.startsWith('heif') || brand.startsWith('msf1')) return 'image/heif';
    return 'video/mp4';
  }

  // Matroska / WebM — 1A 45 DF A3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'video/webm';
  }

  return null;
}

export function extensionForVisualMime(mime: string): string {
  switch (normalizeMime(mime)) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/heic':
      return '.heic';
    case 'image/heif':
      return '.heif';
    case 'video/mp4':
      return '.mp4';
    case 'video/quicktime':
      return '.mov';
    case 'video/webm':
      return '.webm';
    default:
      return '.jpg';
  }
}

export function maxReferenceBytesFor(mediaType: VisualMediaType): number {
  return mediaType === 'video' ? UPLOAD_MAX_BYTES.video : UPLOAD_MAX_BYTES.image;
}

/**
 * Declared mime must agree with what the bytes actually are. Returns the resolved
 * mime, or throws a host-readable error.
 */
export function resolveReferenceMime(
  bytes: Uint8Array,
  declaredMime: string
): { mime: string; mediaType: VisualMediaType } {
  const sniffed = sniffVisualMime(bytes);
  if (!sniffed) {
    throw new Error('File must be a JPEG, PNG, WebP, HEIC, MP4, MOV, or WebM');
  }

  const sniffedType = classifyGenerationReferenceMime(sniffed);
  if (!sniffedType) {
    throw new Error('File must be a JPEG, PNG, WebP, HEIC, MP4, MOV, or WebM');
  }

  const declaredType = classifyGenerationReferenceMime(declaredMime);
  if (declaredType && declaredType !== sniffedType) {
    throw new Error('File contents do not match its type');
  }

  return { mime: sniffed, mediaType: sniffedType };
}

export function marketingReferenceStoragePath(
  propertyId: string,
  fileKey: string,
  ext: string
): string {
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  const safeKey = fileKey.replace(/[^a-zA-Z0-9_-]/g, '');
  return `marketing-ai-refs/${propertyId}/${safeKey}${safeExt}`;
}

export function marketingGenerationStoragePath(
  propertyId: string,
  jobId: string,
  ext: string
): string {
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `marketing-ai/${propertyId}/${safeJobId}${safeExt}`;
}

/**
 * Design canvas uploads (collage photos + anything dropped through Polotno's own
 * Upload panel) — a dedicated prefix with no auto-prune and no gallery mutation,
 * so a throwaway canvas asset never appears on the public property listing and a
 * saved design's images never expire out from under it.
 */
export function marketingUploadStoragePath(
  propertyId: string,
  fileKey: string,
  ext: string
): string {
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  const safeKey = fileKey.replace(/[^a-zA-Z0-9_-]/g, '');
  return `marketing-uploads/${propertyId}/${safeKey}${safeExt}`;
}

/** Upsert so a reclaimed retry overwrites the same object instead of orphaning one. */
export async function uploadGenerationBytes(
  supabase: SupabaseClient,
  storagePath: string,
  bytes: Uint8Array,
  mime: string
): Promise<string> {
  const { error } = await supabase.storage.from(PROPERTY_MEDIA_BUCKET).upload(storagePath, bytes, {
    contentType: normalizeMime(mime) || 'application/octet-stream',
    upsert: true,
  });
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROPERTY_MEDIA_BUCKET).getPublicUrl(storagePath);
  return formatPublicUrl(publicUrl);
}

export async function removeGenerationObjects(
  supabase: SupabaseClient,
  storagePaths: string[]
): Promise<void> {
  const paths = storagePaths.filter(Boolean);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(PROPERTY_MEDIA_BUCKET).remove(paths);
  if (error) {
    console.warn('[marketingGenerationStorage] remove failed (non-fatal):', error.message);
  }
}

/** PNG IHDR / JPEG SOF dimensions — best effort, used only for gallery layout. */
const VIDEO_DOWNLOAD_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Downloads a Veo-generated video from its operation response URI. The download
 * requires the `x-goog-api-key` header (an ordinary signed URL does not work), so this
 * must run server-side — mirrors `fetchRemoteAudioBytes` in marketingMusicStorage.ts.
 */
export async function fetchGeneratedVideoBytes(
  uri: string,
  apiKey: string
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const res = await fetch(uri, {
    redirect: 'follow',
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!res.ok) {
    throw new Error(`Could not download the generated video (${res.status})`);
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > VIDEO_DOWNLOAD_MAX_BYTES) {
    throw new Error('Generated video exceeds the 50MB limit');
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error('Generated video is empty');
  }
  if (buffer.byteLength > VIDEO_DOWNLOAD_MAX_BYTES) {
    throw new Error('Generated video exceeds the 50MB limit');
  }

  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim();
  return { bytes: new Uint8Array(buffer), mimeType: contentType || 'video/mp4' };
}

export function readImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes.byteLength >= 24) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.byteLength) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1]!;
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 carry the frame size.
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      }
      offset += 2 + view.getUint16(offset + 2);
    }
  }

  return null;
}
