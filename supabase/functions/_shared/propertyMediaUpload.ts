/**
 * Shared property gallery media upload — used by upload-property-media and AI assistant apply.
 */

import { createClient } from './supabaseJs.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  classifyPropertyMediaMime,
  countPropertyMediaByType,
  maxBytesForPropertyMediaType,
  MAX_PROPERTY_IMAGES,
  MAX_PROPERTY_VIDEOS,
  normalizePropertyMediaItems,
  PROPERTY_MEDIA_BUCKET,
  propertyMediaStoragePath,
  type PropertyMediaRecord,
} from './propertyMedia.ts';
import { copyBytes, formatPublicUrl } from './utils.ts';

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
    case 'image/heic':
      return '.heic';
    case 'image/heif':
      return '.heif';
    case 'video/webm':
      return '.webm';
    case 'video/quicktime':
      return '.mov';
    case 'video/x-msvideo':
      return '.avi';
    case 'video/x-matroska':
      return '.mkv';
    case 'video/ogg':
      return '.ogv';
    default:
      return mime.startsWith('video/') ? '.mp4' : '.jpg';
  }
}

export async function readPropertyMedia(propertyId: string): Promise<PropertyMediaRecord[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('properties')
    .select('settings')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const settings = data?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return [];
  }
  return normalizePropertyMediaItems((settings as Record<string, unknown>).media);
}

export async function persistPropertyMedia(
  propertyId: string,
  items: PropertyMediaRecord[]
): Promise<void> {
  const supabase = createServiceClient();
  const { data, error: readError } = await supabase
    .from('properties')
    .select('settings')
    .eq('id', propertyId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  const currentSettings =
    data?.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
      ? (data.settings as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase
    .from('properties')
    .update({
      settings: {
        ...currentSettings,
        media: items,
      },
    })
    .eq('id', propertyId);

  if (updateError) throw new Error(updateError.message);
}

export type ApplyPropertyMediaInput = {
  propertyId: string;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  /** When true and file is an image, force this item to be primary. */
  setPrimary?: boolean;
};

export type ApplyPropertyMediaResult = {
  item: PropertyMediaRecord;
  media: PropertyMediaRecord[];
};

export async function applyPropertyMediaFromBytes(
  input: ApplyPropertyMediaInput
): Promise<ApplyPropertyMediaResult> {
  const mime = (input.mimeType || '').toLowerCase();
  const mediaType = classifyPropertyMediaMime(mime);
  if (!mediaType) {
    throw new Error('File must be a supported image or video format');
  }

  const file = new File([copyBytes(input.bytes)], input.fileName || 'media', { type: mime });
  const maxBytes = maxBytesForPropertyMediaType(mediaType);
  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`File must be ${limitMb} MB or smaller`);
  }

  const current = await readPropertyMedia(input.propertyId);
  const counts = countPropertyMediaByType(current);
  if (mediaType === 'image' && counts.images >= MAX_PROPERTY_IMAGES) {
    throw new Error(`At most ${MAX_PROPERTY_IMAGES} images are allowed`);
  }
  if (mediaType === 'video' && counts.videos >= MAX_PROPERTY_VIDEOS) {
    throw new Error(`At most ${MAX_PROPERTY_VIDEOS} video is allowed`);
  }

  const mediaId = crypto.randomUUID();
  const ext = extensionForMime(mime, input.fileName || 'media');
  const storagePath = propertyMediaStoragePath(input.propertyId, mediaId, ext);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_MEDIA_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: mime, cacheControl: '31536000' });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROPERTY_MEDIA_BUCKET).getPublicUrl(storagePath);
  const safePublicUrl = formatPublicUrl(publicUrl);

  const autoPrimary =
    mediaType === 'image' && !current.some((item) => item.type === 'image' && item.isPrimary);
  const shouldBePrimary = mediaType === 'image' && (input.setPrimary === true || autoPrimary);

  let nextItems = current.map((item) =>
    shouldBePrimary && item.type === 'image' ? { ...item, isPrimary: false } : item
  );

  const newItem: PropertyMediaRecord = {
    id: mediaId,
    url: safePublicUrl,
    storagePath,
    type: mediaType,
    isPrimary: shouldBePrimary,
    order: nextItems.length,
  };

  const next = normalizePropertyMediaItems([...nextItems, newItem]);
  await persistPropertyMedia(input.propertyId, next);

  return { item: newItem, media: next };
}
