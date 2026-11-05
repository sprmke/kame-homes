/**
 * chat-templates — read-only list/preview of property templates a host can send
 * in chat. Requires `inbox:view` on the property (not `templates:view`), so any
 * teammate who can answer the guest inbox can pick a template. Email templates
 * are never returned. Parking inboxes have no templates module and get [].
 */

import { renderChatTemplateForChat } from '../_shared/chatTemplateMessage.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { conversationAllowedInScope, getConversationById } from '../_shared/socialInboxService.ts';
import { resolveMetaConnectionIdsForScope } from '../_shared/metaInboxScope.ts';
import { serializePropertyTemplatesForAdmin } from '../_shared/propertyTemplates.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('chat-templates', async (req) => {
  if (req.method !== 'GET') return jsonError(req, 'Method not allowed', 405);

  const ctx = await resolveInboxAccess(req, 'view');
  if (!ctx.propertyId) return jsonSuccess(req, { templates: [] });

  const url = new URL(req.url);
  const templateKey = url.searchParams.get('template_key')?.trim() || '';

  if (templateKey) {
    const conversationId = url.searchParams.get('conversation_id')?.trim() || '';
    let conversation = null;
    if (conversationId) {
      conversation = await getConversationById(ctx.orgId, conversationId);
      if (!conversation) return jsonError(req, 'Conversation not found', 404);
      const metaIds = new Set(await resolveMetaConnectionIdsForScope(ctx.orgId, ctx.scope));
      if (
        !conversationAllowedInScope(conversation, {
          propertyId: ctx.propertyId,
          parkingId: ctx.parkingId,
          metaIds,
        })
      ) {
        return jsonError(req, 'Conversation not found', 404);
      }
    }

    try {
      const rendered = await renderChatTemplateForChat({
        propertyId: ctx.propertyId,
        templateKey,
        conversation,
        bookingId: url.searchParams.get('booking_id')?.trim() || null,
      });
      return jsonSuccess(req, {
        snapshot: rendered.snapshot,
        plainText: rendered.plainText,
      });
    } catch (err) {
      return jsonError(req, (err as Error).message, 400);
    }
  }

  const data = await serializePropertyTemplatesForAdmin(ctx.propertyId);
  const templates = data.templates
    .filter((template) => template.category !== 'email')
    .map((template) => ({
      templateKey: template.templateKey,
      name: template.name,
      category: template.category,
      description: template.description,
      sectionImageUrl: template.sectionImageUrl,
      folderId: template.folderId,
      updatedAt: template.updatedAt,
    }));

  return jsonSuccess(req, { templates });
});
