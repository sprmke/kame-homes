/**
 * Marketing video background audio — property-media storage (not gallery settings.media).
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { PROPERTY_MEDIA_BUCKET } from './propertyMedia.ts';
import { formatPublicUrl } from './utils.ts';

export const MARKETING_AUDIO_MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/webm',
]);

export function isAllowedAudioMime(mime: string): boolean {
  const normalized = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  return ALLOWED_AUDIO_MIMES.has(normalized) || normalized.startsWith('audio/');
}

/** Detect common audio containers when servers return application/octet-stream. */
export function sniffAudioMime(bytes: Uint8Array): string | null {
  if (bytes.byteLength < 4) return null;

  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'audio/mpeg';
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return 'audio/mpeg';
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return 'audio/ogg';
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes.byteLength >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return 'audio/wav';
  }
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'audio/mp4';
  }

  return null;
}

export function resolveAudioMime(
  bytes: Uint8Array,
  declaredMime: string,
  fileName?: string
): string {
  const normalized = declaredMime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (isAllowedAudioMime(normalized) && normalized !== 'application/octet-stream') {
    return normalized;
  }

  const sniffed = sniffAudioMime(bytes);
  if (sniffed) return sniffed;

  const pathExt = fileName?.split('.').pop()?.toLowerCase();
  if (pathExt === 'mp3') return 'audio/mpeg';
  if (pathExt === 'wav') return 'audio/wav';
  if (pathExt === 'ogg') return 'audio/ogg';
  if (pathExt === 'm4a' || pathExt === 'aac') return 'audio/mp4';
  if (pathExt === 'webm') return 'audio/webm';

  return normalized || 'application/octet-stream';
}

export function extensionForAudioMime(mime: string, fileName?: string): string {
  const fromName = fileName?.includes('.') ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';
  if (fromName && fromName.length <= 5 && fromName !== '.') return fromName;

  const base = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  switch (base) {
    case 'audio/wav':
    case 'audio/x-wav':
      return '.wav';
    case 'audio/ogg':
      return '.ogg';
    case 'audio/mp4':
    case 'audio/x-m4a':
      return '.m4a';
    case 'audio/aac':
      return '.aac';
    case 'audio/webm':
      return '.webm';
    default:
      return '.mp3';
  }
}

export function marketingAudioStoragePath(
  propertyId: string,
  fileKey: string,
  ext: string
): string {
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  const safeKey = fileKey.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${propertyId}/marketing-audio/${safeKey}${safeExt}`;
}

export async function uploadMarketingAudioBytes(
  supabase: SupabaseClient,
  propertyId: string,
  bytes: Uint8Array,
  mime: string,
  ext: string,
  fileKey: string
): Promise<string> {
  if (bytes.byteLength > MARKETING_AUDIO_MAX_BYTES) {
    throw new Error(
      `Audio file exceeds ${Math.round(MARKETING_AUDIO_MAX_BYTES / (1024 * 1024))}MB limit`
    );
  }

  const resolvedMime = resolveAudioMime(bytes, mime);
  if (!isAllowedAudioMime(resolvedMime)) {
    throw new Error('Unsupported audio format');
  }

  const storagePath = marketingAudioStoragePath(propertyId, fileKey, ext);
  const { error } = await supabase.storage.from(PROPERTY_MEDIA_BUCKET).upload(storagePath, bytes, {
    contentType: resolvedMime.split(';')[0]?.trim() || 'audio/mpeg',
    upsert: true,
  });

  if (error) {
    throw new Error(`Audio upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROPERTY_MEDIA_BUCKET).getPublicUrl(storagePath);

  return formatPublicUrl(publicUrl);
}

export async function fetchRemoteAudioBytes(
  url: string
): Promise<{ bytes: Uint8Array; mime: string; fileName?: string }> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('URL must start with http:// or https://');
  }

  const res = await fetch(trimmed, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'PropertyMarketing/1.0',
      Accept: 'audio/*,application/octet-stream,*/*;q=0.8',
    },
  });
  if (!res.ok) {
    throw new Error(`Could not fetch audio (${res.status})`);
  }

  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const declaredMime =
    contentType.split(';')[0]?.trim().toLowerCase() ?? 'application/octet-stream';

  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > MARKETING_AUDIO_MAX_BYTES) {
    throw new Error(
      `Remote audio exceeds ${Math.round(MARKETING_AUDIO_MAX_BYTES / (1024 * 1024))}MB limit`
    );
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error('Remote audio file is empty');
  }
  if (buffer.byteLength > MARKETING_AUDIO_MAX_BYTES) {
    throw new Error(
      `Remote audio exceeds ${Math.round(MARKETING_AUDIO_MAX_BYTES / (1024 * 1024))}MB limit`
    );
  }

  const bytes = new Uint8Array(buffer);
  const fileName = trimmed.split('/').pop()?.split('?')[0];
  const mime = resolveAudioMime(bytes, declaredMime, fileName);

  if (!isAllowedAudioMime(mime)) {
    throw new Error('URL does not point to a supported audio file');
  }

  return { bytes, mime, fileName };
}
