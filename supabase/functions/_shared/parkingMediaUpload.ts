/**
 * Shared parking cover photo upload — used by upload-parking-media and AI assistant apply.
 */

import { createClient } from './supabaseJs.ts';
import { createServiceClient } from './orgAuth.ts';
import { PROPERTY_MEDIA_BUCKET } from './propertyMedia.ts';
import { assertWithinUploadLimit } from './uploadLimits.ts';
import { formatPublicUrl } from './utils.ts';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

function extensionForMime(mime: string, fileName: string): string {
  const fromName = fileName.includes('.') ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';
  if (fromName && fromName.length <= 6) return fromName;
  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.jpg';
  }
}

function parkingCoverStoragePath(parkingId: string, ext: string): string {
  return `parking/${parkingId}/cover${ext}`;
}

async function readParkingSettings(parkingId: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parkings')
    .select('settings')
    .eq('id', parkingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const settings = data?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {};
  }
  return settings as Record<string, unknown>;
}

async function persistCover(
  parkingId: string,
  coverImage: string | null,
  coverImageStoragePath: string | null
): Promise<{ coverImage: string | null; coverImageStoragePath: string | null }> {
  const supabase = createServiceClient();
  const current = await readParkingSettings(parkingId);
  const nextSettings = { ...current, coverImage, coverImageStoragePath };
  const { error } = await supabase
    .from('parkings')
    .update({ settings: nextSettings, updated_at: new Date().toISOString() })
    .eq('id', parkingId);
  if (error) throw new Error(error.message);
  return { coverImage, coverImageStoragePath };
}

export type ApplyParkingCoverInput = {
  parkingId: string;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
};

export type ApplyParkingCoverResult = {
  coverImage: string;
  coverImageStoragePath: string;
  replacedExisting: boolean;
};

export async function applyParkingCoverFromBytes(
  input: ApplyParkingCoverInput
): Promise<ApplyParkingCoverResult> {
  const mime = (input.mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('File must be JPEG, PNG, WebP, or GIF');
  }

  const file = new File([input.bytes], input.fileName || 'cover.jpg', { type: mime });
  assertWithinUploadLimit(file, 'image');

  const current = await readParkingSettings(input.parkingId);
  const previousPath =
    typeof current.coverImageStoragePath === 'string' ? current.coverImageStoragePath.trim() : '';
  const replacedExisting = Boolean(
    previousPath || (typeof current.coverImage === 'string' && current.coverImage.trim())
  );

  const ext = extensionForMime(mime, input.fileName || 'cover.jpg');
  const storagePath = parkingCoverStoragePath(input.parkingId, ext);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_MEDIA_BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: mime, cacheControl: '300' });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROPERTY_MEDIA_BUCKET).getPublicUrl(storagePath);
  const safePublicUrl = formatPublicUrl(publicUrl);

  await persistCover(input.parkingId, safePublicUrl, storagePath);

  if (
    previousPath &&
    previousPath !== storagePath &&
    previousPath.startsWith(`parking/${input.parkingId}/`)
  ) {
    const { error: removeError } = await supabase.storage
      .from(PROPERTY_MEDIA_BUCKET)
      .remove([previousPath]);
    if (removeError) {
      console.warn('[parkingMediaUpload] Previous cover delete failed:', removeError.message);
    }
  }

  return {
    coverImage: safePublicUrl,
    coverImageStoragePath: storagePath,
    replacedExisting,
  };
}
