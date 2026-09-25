/**
 * AI reply suggestion for a conversation.
 */

import { suggestInboxReply } from '../_shared/socialInboxAiService.ts';
import { isAiPlatformDisabledError, isAiQuotaError } from '../_shared/aiUsageService.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  InboxSendReplyError,
  loadInboxConversationInScope,
} from '../_shared/inboxSendReplyAction.ts';
import { resolveMetaConnectionIdsForScope } from '../_shared/metaInboxScope.ts';
import { listMessages } from '../_shared/socialInboxService.ts';
import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('social-inbox-ai-suggest', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await rateLimitGate(req, {
    scope: 'social-inbox-ai-suggest',
    identity: identityFromRequest(req, user),
    limit: 40,
    windowSec: 3600,
  });
  if (limited) return limited;

  const body = (await readJsonBody(req)) as Record<string, unknown>;
  const ctx = await resolveInboxAccess(req, 'reply', body);
  const conversationId = String(body.conversationId ?? '').trim();
  if (!conversationId) {
    return jsonError(req, 'conversationId required', 400);
  }

  // Same scope check as social-inbox-messages / send: a property- or parking-scoped staffer must
  // not be able to draft (and bill) a reply from another property's transcript.
  let conv;
  try {
    const metaIds = new Set(await resolveMetaConnectionIdsForScope(ctx.orgId, ctx.scope));
    conv = await loadInboxConversationInScope(ctx, conversationId, metaIds);
  } catch (err) {
    if (err instanceof InboxSendReplyError) return jsonError(req, err.message, err.status);
    throw err;
  }

  const { messages } = await listMessages(ctx.orgId, conversationId, { limit: 20 });
  const sb = createServiceClient();
  const settingsQuery = sb
    .from('social_inbox_settings')
    .select('ai_system_prompt')
    .eq('organization_id', ctx.orgId);
  const { data: settings } = await (
    ctx.parkingId
      ? settingsQuery.eq('parking_id', ctx.parkingId)
      : settingsQuery.is('parking_id', null)
  ).maybeSingle();

  try {
    const result = await suggestInboxReply({
      orgId: ctx.orgId,
      platform: conv.platform,
      conversationType: conv.conversation_type,
      participantName: conv.participant_name,
      propertyId: (conv.property_id as string | null) ?? null,
      inquiryCheckIn: (conv.inquiry_check_in as string | null) ?? null,
      inquiryCheckOut: (conv.inquiry_check_out as string | null) ?? null,
      messages: messages.map((m) => ({
        direction: m.direction,
        body: m.body_text,
        sentAt: m.sent_at,
      })),
      systemPromptOverride: (settings?.ai_system_prompt as string | null) ?? null,
      actorUserId: user.id,
      actorType: 'staff',
    });
    return jsonSuccess(req, {
      suggestion: result.suggestion,
      flagged: result.flagged,
    });
  } catch (e) {
    if (isAiQuotaError(e)) {
      return jsonResponse(req, { success: false, error: e.message, upgradeHook: true }, 429);
    }
    if (isAiPlatformDisabledError(e)) {
      return jsonError(req, e.message, 503);
    }
    return jsonError(req, (e as Error).message, 503);
  }
});
