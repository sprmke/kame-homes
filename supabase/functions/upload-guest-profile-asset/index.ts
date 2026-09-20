/**
 * upload-guest-profile-asset — Authenticated guest avatar upload.
 */

import { createClient } from '../_shared/supabaseJs.ts';

import { patchGuestProfile } from '../_shared/guestProfileService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { assertWithinUploadLimit } from '../_shared/uploadLimits.ts';
import { formatPublicUrl } from '../_shared/utils.ts';

const BUCKET = 'guest-profile-assets';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

serveAuthenticated('upload-guest-profile-asset', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  // Durable per-user upload rate limit. Plan: docs/workflow/for-testing/captcha-anti-spam-hardening.md
  const limited = await rateLimitGate(req, {
    scope: 'upload-guest-profile-asset',
    identity: identityFromRequest(req, user),
    limit: 40,
    windowSec: 600,
  });
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonError(req, 'file is required', 400);
  }

  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return jsonError(req, 'File must be JPEG, PNG, or WebP', 400);
  }
  assertWithinUploadLimit(file, 'avatar');

  const ext =
    mime === 'image/png'
      ? '.png'
      : mime === 'image/webp'
        ? '.webp'
        : mime === 'image/heic' || mime === 'image/heif'
          ? '.heic'
          : '.jpg';
  const storagePath = `${user.id}/avatar${ext}`;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: mime, cacheControl: '300' });

  if (uploadError) {
    return jsonError(req, `Upload failed: ${uploadError.message}`, 500);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const avatarUrl = formatPublicUrl(publicUrl);

  await patchGuestProfile(user, { avatarUrl });

  return jsonSuccess(req, { avatarUrl });
});
