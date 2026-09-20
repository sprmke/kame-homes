import type { SupabaseClient } from './supabaseJs.ts';

import { formatPublicUrl } from './utils.ts';

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export function validateImageUpload(
  file: File,
  fileName: string,
  allowedMime: Set<string>,
  options?: { maxBytes?: number; mimeError?: string }
): { mime: string; ext: string } {
  if (!file) throw new Error('file is required');
  if (!fileName) throw new Error('fileName is required');

  const mime = (file.type || '').toLowerCase();
  if (!allowedMime.has(mime)) {
    throw new Error(options?.mimeError ?? 'File must be JPEG, PNG, or WebP');
  }

  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  if (file.size > maxBytes) {
    throw new Error('File must be 5 MB or smaller');
  }

  const ext = fileName.includes('.')
    ? `.${fileName.split('.').pop()?.toLowerCase()}`
    : mime === 'image/png'
      ? '.png'
      : mime === 'image/webp'
        ? '.webp'
        : '.jpg';

  return { mime, ext };
}

export async function uploadPublicStorageObject(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string,
  file: File,
  mime: string
): Promise<string> {
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { upsert: true, contentType: mime, cacheControl: '300' });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return formatPublicUrl(publicUrl);
}
