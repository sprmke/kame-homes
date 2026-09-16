/**
 * Upload marketing export bytes (from data URLs) to public property-media storage.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { PROPERTY_MEDIA_BUCKET } from './propertyMedia.ts';
import { formatPublicUrl } from './utils.ts';

export type ParsedDataUrl = {
  mime: string;
  bytes: Uint8Array;
  ext: string;
};

export function parseDataUrl(dataUrl: string): ParsedDataUrl | null {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/i.exec(dataUrl.trim());
  if (!match) return null;

  const mime = (match[1] || 'application/octet-stream').toLowerCase();
  const payload = match[2] ?? '';

  try {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const ext =
      mime === 'image/png'
        ? '.png'
        : mime === 'image/jpeg' || mime === 'image/jpg'
          ? '.jpg'
          : mime === 'image/webp'
            ? '.webp'
            : mime === 'video/mp4'
              ? '.mp4'
              : mime === 'video/webm'
                ? '.webm'
                : '.bin';

    return { mime, bytes, ext };
  } catch {
    return null;
  }
}

export function isDataUrl(value: string): boolean {
  return value.trim().startsWith('data:');
}

export function marketingExportStoragePath(
  propertyId: string,
  ext: string,
  prefix = 'marketing-exports'
): string {
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  const stamp = Date.now();
  const rand = crypto.randomUUID().slice(0, 8);
  return `${propertyId}/${prefix}/${stamp}-${rand}${safeExt}`;
}

export async function uploadMarketingMediaBytes(
  supabase: SupabaseClient,
  propertyId: string,
  bytes: Uint8Array,
  mime: string,
  ext: string
): Promise<string> {
  const storagePath = marketingExportStoragePath(propertyId, ext);
  const { error } = await supabase.storage.from(PROPERTY_MEDIA_BUCKET).upload(storagePath, bytes, {
    contentType: mime,
    upsert: true,
  });

  if (error) {
    throw new Error(`Marketing media upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROPERTY_MEDIA_BUCKET).getPublicUrl(storagePath);

  return formatPublicUrl(publicUrl);
}

/** Accepts https URL or data URL; returns a public https URL suitable for Meta Graph API. */
export async function resolvePublicMarketingMediaUrl(
  supabase: SupabaseClient,
  propertyId: string,
  mediaUrl: string
): Promise<string> {
  const trimmed = mediaUrl.trim();
  if (!trimmed) throw new Error('mediaUrl is required');

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (!isDataUrl(trimmed)) {
    throw new Error('mediaUrl must be an https URL or data URL');
  }

  const parsed = parseDataUrl(trimmed);
  if (!parsed) throw new Error('Invalid data URL');

  return uploadMarketingMediaBytes(supabase, propertyId, parsed.bytes, parsed.mime, parsed.ext);
}

function marketingExtFromMime(mime: string, fileName?: string): string {
  const fromName = fileName?.includes('.') ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';
  if (fromName && fromName.length <= 6) return fromName;
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'video/webm') return '.webm';
  if (mime === 'video/quicktime') return '.mov';
  return mime.startsWith('video/') ? '.mp4' : '.jpg';
}

/** Upload assistant chat attachment bytes for Meta publish (images/videos only). */
export async function uploadMarketingMediaFromAssistantBytes(
  supabase: SupabaseClient,
  propertyId: string,
  bytes: Uint8Array,
  mime: string,
  fileName?: string
): Promise<string> {
  const normalized = mime.toLowerCase();
  if (!normalized.startsWith('image/') && !normalized.startsWith('video/')) {
    throw new Error('Marketing publish supports images and videos only');
  }
  const ext = marketingExtFromMime(normalized, fileName);
  return uploadMarketingMediaBytes(supabase, propertyId, bytes, normalized, ext);
}
