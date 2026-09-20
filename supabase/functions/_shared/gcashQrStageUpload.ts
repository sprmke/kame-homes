/**
 * Shared GCash QR staging upload (does not commit payment_methods — OTP/settings token required).
 */

import { createClient } from './supabaseJs.ts';
import { assertWithinUploadLimit } from './uploadLimits.ts';
import { formatPublicUrl } from './utils.ts';

const PROPERTY_BUCKET = 'app-settings-assets';
const PARKING_BUCKET = 'app-settings-assets';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type StageGcashQrInput = {
  scope: 'property' | 'parking';
  scopeId: string;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
};

export type StageGcashQrResult = {
  url: string;
  bucket: string;
  path: string;
  scope: 'property' | 'parking';
  scopeId: string;
  nextStep: string;
};

export async function stageGcashQrFromBytes(input: StageGcashQrInput): Promise<StageGcashQrResult> {
  const mime = (input.mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('File must be JPEG, PNG, or WebP');
  }
  const file = new File([input.bytes], input.fileName || 'gcash-qr.jpg', { type: mime });
  assertWithinUploadLimit(file, 'image');

  const ext = input.fileName.includes('.')
    ? `.${input.fileName.split('.').pop()?.toLowerCase()}`
    : mime === 'image/png'
      ? '.png'
      : mime === 'image/webp'
        ? '.webp'
        : '.jpg';

  const prefix = input.scope === 'property' ? 'gcash-qr' : 'parking-gcash-qr';
  const storagePath = `${prefix}/${input.scopeId}/${crypto.randomUUID()}${ext}`;
  const bucket = input.scope === 'property' ? PROPERTY_BUCKET : PARKING_BUCKET;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { upsert: true, contentType: mime, cacheControl: '31536000' });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  const url = formatPublicUrl(publicUrl);

  return {
    url,
    bucket,
    path: storagePath,
    scope: input.scope,
    scopeId: input.scopeId,
    nextStep:
      'QR staged only. Open Payment settings, attach this QR, and confirm with the email verification code — the assistant cannot skip OTP.',
  };
}
