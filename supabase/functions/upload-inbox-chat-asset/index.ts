/**
 * upload-inbox-chat-asset — Host inbox image/PDF upload (web chat replies).
 */

import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import {
  uploadInboxChatAssetFromBytes,
  INBOX_CHAT_ALLOWED_MIME,
} from '../_shared/inboxChatAssetUpload.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { conversationAllowedInScope, getConversationById } from '../_shared/socialInboxService.ts';
import { resolveMetaConnectionIdsForScope } from '../_shared/metaInboxScope.ts';

serveAuthenticated('upload-inbox-chat-asset', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  // Durable per-user upload rate limit. Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
  const limited = await rateLimitGate(req, {
    scope: 'upload-inbox-chat-asset',
    identity: identityFromRequest(req, user),
    limit: 60,
    windowSec: 600,
  });
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get('file');
  const conversationId = String(
    formData.get('conversationId') ?? formData.get('conversation_id') ?? ''
  ).trim();
  const propertyId = String(formData.get('propertyId') ?? formData.get('property_id') ?? '').trim();
  const parkingId = String(formData.get('parkingId') ?? formData.get('parking_id') ?? '').trim();

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

  const scopeBody: Record<string, unknown> = {};
  if (propertyId) scopeBody.propertyId = propertyId;
  if (parkingId) scopeBody.parkingId = parkingId;

  const ctx = await resolveInboxAccess(req, 'reply', scopeBody);
  const conv = await getConversationById(ctx.orgId, conversationId);
  if (!conv) {
    return jsonError(req, 'Conversation not found', 404);
  }

  if (conv.platform !== 'web') {
    return jsonError(req, 'Attachments are only supported for website chat', 400);
  }

  const metaIds = new Set(await resolveMetaConnectionIdsForScope(ctx.orgId, ctx.scope));
  if (
    !conversationAllowedInScope(conv, {
      propertyId: ctx.propertyId,
      parkingId: ctx.parkingId,
      metaIds,
    })
  ) {
    return jsonError(req, 'Conversation not found', 404);
  }

  void user;

  const ext = mime === 'application/pdf' ? '.pdf' : mime === 'image/png' ? '.png' : '.jpg';
  const fileName = String(formData.get('fileName') ?? file.name ?? `upload${ext}`).trim();

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const attachment = await uploadInboxChatAssetFromBytes({
      organizationId: conv.organization_id,
      conversationId: conv.id,
      bytes,
      mimeType: mime,
      fileName,
    });
    return jsonSuccess(req, { attachment });
  } catch (err) {
    return jsonError(req, err instanceof Error ? err.message : String(err), 400);
  }
});
