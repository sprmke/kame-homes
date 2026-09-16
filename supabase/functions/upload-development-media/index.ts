/**
 * upload-development-media — Super-admin upload/delete for development gallery media.
 * Auth: verifySuperAdminJwt.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '../_shared/supabaseJs.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';
import { formatPublicUrl } from '../_shared/utils.ts';
import {
  classifyPropertyMediaMime,
  countPropertyMediaByType,
  developmentMediaStoragePath,
  maxBytesForPropertyMediaType,
  MAX_PROPERTY_IMAGES,
  MAX_PROPERTY_VIDEOS,
  normalizePropertyMediaItems,
  PROPERTY_MEDIA_BUCKET,
  type PropertyMediaRecord,
} from '../_shared/propertyMedia.ts';
import { capturePostHogException } from '../_shared/posthog.ts';

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

async function readCurrentMedia(developmentId: string): Promise<PropertyMediaRecord[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('developments')
    .select('settings')
    .eq('id', developmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const settings = data?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return [];
  }
  return normalizePropertyMediaItems((settings as Record<string, unknown>).media);
}

async function persistMedia(developmentId: string, items: PropertyMediaRecord[]): Promise<void> {
  const supabase = createServiceClient();
  const { data, error: readError } = await supabase
    .from('developments')
    .select('settings, cover_image_url')
    .eq('id', developmentId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  const currentSettings =
    data?.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
      ? (data.settings as Record<string, unknown>)
      : {};

  const images = items.filter((item) => item.type === 'image');
  const primary = images.find((item) => item.isPrimary) ?? images[0];
  const imageUrls = images.map((item) => item.url);

  const { error: updateError } = await supabase
    .from('developments')
    .update({
      cover_image_url: primary?.url ?? data?.cover_image_url ?? null,
      settings: {
        ...currentSettings,
        media: items,
        images: imageUrls,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', developmentId);

  if (updateError) throw new Error(updateError.message);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    await verifySuperAdminJwt(req);

    const url = new URL(req.url);
    const developmentId = url.searchParams.get('development_id')?.trim() ?? '';
    if (!developmentId) {
      throw new Error('development_id is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: development, error: loadError } = await supabase
      .from('developments')
      .select('id')
      .eq('id', developmentId)
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);
    if (!development) throw new Error('Development not found');

    if (req.method === 'DELETE') {
      const body = (await req.json().catch(() => ({}))) as {
        storagePath?: string;
        mediaId?: string;
      };
      const storagePath = typeof body.storagePath === 'string' ? body.storagePath.trim() : '';
      const mediaId = typeof body.mediaId === 'string' ? body.mediaId.trim() : '';

      if (!storagePath && !mediaId) {
        throw new Error('storagePath or mediaId is required');
      }

      const current = await readCurrentMedia(developmentId);
      const next = current.filter((item) => {
        if (mediaId && item.id === mediaId) return false;
        if (storagePath && item.storagePath === storagePath) return false;
        return true;
      });

      const normalized = normalizePropertyMediaItems(next);
      await persistMedia(developmentId, normalized);

      if (storagePath) {
        const expectedPrefix = `developments/${developmentId}/`;
        if (!storagePath.startsWith(expectedPrefix)) {
          throw new Error('Invalid storage path');
        }
        const { error: removeError } = await supabase.storage
          .from(PROPERTY_MEDIA_BUCKET)
          .remove([storagePath]);
        if (removeError) {
          console.warn('[upload-development-media] Storage delete failed:', removeError.message);
        }
      }

      return new Response(JSON.stringify({ success: true, data: { media: normalized } }), {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed`);
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const fileName = (formData.get('fileName') as string) || file?.name || '';

    if (!file) throw new Error('file is required');
    if (!fileName) throw new Error('fileName is required');

    const mime = (file.type || '').toLowerCase();
    const mediaType = classifyPropertyMediaMime(mime);
    if (!mediaType) {
      throw new Error('File must be a supported image or video format');
    }

    const maxBytes = maxBytesForPropertyMediaType(mediaType);
    if (file.size > maxBytes) {
      const limitMb = Math.round(maxBytes / (1024 * 1024));
      throw new Error(`File must be ${limitMb} MB or smaller`);
    }

    const current = await readCurrentMedia(developmentId);
    const counts = countPropertyMediaByType(current);
    if (mediaType === 'image' && counts.images >= MAX_PROPERTY_IMAGES) {
      throw new Error(`At most ${MAX_PROPERTY_IMAGES} images are allowed`);
    }
    if (mediaType === 'video' && counts.videos >= MAX_PROPERTY_VIDEOS) {
      throw new Error(`At most ${MAX_PROPERTY_VIDEOS} video is allowed`);
    }

    const mediaId = crypto.randomUUID();
    const ext = extensionForMime(mime, fileName);
    const storagePath = developmentMediaStoragePath(developmentId, mediaId, ext);

    const { error: uploadError } = await supabase.storage
      .from(PROPERTY_MEDIA_BUCKET)
      .upload(storagePath, file, { upsert: false, contentType: mime });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(PROPERTY_MEDIA_BUCKET).getPublicUrl(storagePath);
    const safePublicUrl = formatPublicUrl(publicUrl);

    const shouldBePrimary =
      mediaType === 'image' && !current.some((item) => item.type === 'image' && item.isPrimary);

    const newItem: PropertyMediaRecord = {
      id: mediaId,
      url: safePublicUrl,
      storagePath,
      type: mediaType,
      isPrimary: shouldBePrimary,
      order: current.length,
    };

    const next = normalizePropertyMediaItems([...current, newItem]);
    await persistMedia(developmentId, next);

    console.log(
      `[upload-development-media] Uploaded ${mediaType} for ${developmentId}: ${storagePath}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          item: newItem,
          media: next,
        },
      }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[upload-development-media]', error);
    const message = error instanceof Error ? error.message : 'Request failed';
    const status = message.includes('Unauthorized') || message.includes('restricted') ? 403 : 400;
    await capturePostHogException(error, { logPrefix: 'upload-development-media', request: req });

    return new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
