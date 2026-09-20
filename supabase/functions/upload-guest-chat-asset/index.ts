/**
 * upload-guest-chat-asset — Guest web chat image/PDF upload.
 */

import { createClient } from '../_shared/supabaseJs.ts';

import { assertGuestOwnsWebConversation } from '../_shared/webGuestChatService.ts';
import type { NormalizedInboxAttachment } from '../_shared/inboxAttachments.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { assertWithinUploadLimit } from '../_shared/uploadLimits.ts';
import { formatPublicUrl } from '../_shared/utils.ts';

const BUCKET = 'guest-chat-attachments';
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

serveAuthenticated('upload-guest-chat-asset', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  // Durable per-user upload rate limit. Plan: docs/workflow/for-testing/captcha-anti-spam-hardening.md
  const limited = await rateLimitGate(req, {
    scope: 'upload-guest-chat-asset',
    identity: identityFromRequest(req, user),
    limit: 40,
    windowSec: 600,
  });
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get('file');
  const conversationId = String(
    formData.get('conversationId') ?? formData.get('conversation_id') ?? ''
  ).trim();

  if (!(file instanceof File)) {
    return jsonError(req, 'file is required', 400);
  }
  if (!conversationId) {
    return jsonError(req, 'conversationId is required', 400);
  }

  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return jsonError(req, 'File must be JPEG, PNG, WebP, HEIC, or PDF', 400);
  }
  assertWithinUploadLimit(file, mime === 'application/pdf' ? 'pdf' : 'image');

  let conv;
  try {
    conv = await assertGuestOwnsWebConversation(user.id, conversationId);
  } catch (e) {
    const message = (e as Error).message;
    if (message === 'Conversation not found') return jsonError(req, message, 404);
    throw e;
  }

  const ext =
    mime === 'image/png'
      ? '.png'
      : mime === 'image/webp'
        ? '.webp'
        : mime === 'application/pdf'
          ? '.pdf'
          : mime === 'image/heic'
            ? '.heic'
            : mime === 'image/heif'
              ? '.heif'
              : '.jpg';
  const fileName = String(formData.get('fileName') ?? file.name ?? `upload${ext}`).trim();
  const safeName = fileName.replace(/[^\w.\-() ]+/g, '_').slice(0, 120) || `upload${ext}`;
  const storagePath = `${conv.organization_id}/${conv.id}/${crypto.randomUUID()}${ext}`;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: mime, cacheControl: '31536000' });

  if (uploadError) {
    return jsonError(req, `Upload failed: ${uploadError.message}`, 500);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const url = formatPublicUrl(publicUrl);

  const attachment: NormalizedInboxAttachment = {
    kind: mime === 'application/pdf' ? 'file' : 'image',
    url,
    label: safeName,
  };

  return jsonSuccess(req, { attachment });
});
