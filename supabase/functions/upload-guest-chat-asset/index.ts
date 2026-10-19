/**
 * upload-guest-chat-asset — Guest web chat image/PDF upload.
 */

import { assertGuestOwnsWebConversation } from '../_shared/webGuestChatService.ts';
import {
  INBOX_CHAT_ALLOWED_MIME,
  uploadInboxChatAssetFromBytes,
} from '../_shared/inboxChatAssetUpload.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

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
  if (!INBOX_CHAT_ALLOWED_MIME.has(mime)) {
    return jsonError(req, 'File must be JPEG, PNG, WebP, HEIC, or PDF', 400);
  }

  let conv;
  try {
    conv = await assertGuestOwnsWebConversation(user.id, conversationId);
  } catch (e) {
    const message = (e as Error).message;
    if (message === 'Conversation not found') return jsonError(req, message, 404);
    throw e;
  }

  try {
    const attachment = await uploadInboxChatAssetFromBytes({
      organizationId: conv.organization_id,
      conversationId: conv.id,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: mime,
      fileName: String(formData.get('fileName') ?? file.name ?? '').trim(),
    });
    return jsonSuccess(req, { attachment });
  } catch (err) {
    return jsonError(req, err instanceof Error ? err.message : String(err), 400);
  }
});
