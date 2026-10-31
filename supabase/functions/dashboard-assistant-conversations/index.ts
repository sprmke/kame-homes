/**
 * dashboard-assistant-conversations — the signed-in user's own AI assistant conversations.
 * Conversations are private per user (docs/workflow/done/ai-dashboard-assistant.md §4).
 *
 * GET    ?org_slug=&offset=&limit=&q=&archived=  list (pinned first, then newest), paged
 * GET    ?conversation_id=                        one thread + its messages
 * PATCH  ?conversation_id=  { title?, pinned?, archived? }
 * DELETE ?conversation_id=                        delete (messages cascade, Storage best-effort)
 *
 * activity-log: N/A — private per-user chat history, no org / property / parking state changes.
 */

import { removeConversationAttachments } from '../_shared/dashboardAssistantAttachments.ts';
import {
  CONVERSATION_SUMMARY_COLUMNS,
  pageResult,
  parseConversationListQuery,
  parseConversationPatch,
} from '../_shared/dashboardAssistantConversations.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  readOrgIdFromUrl,
  readOrgSlugFromUrl,
  resolveOrgAccessContext,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

/** Thread load cap; far above any real conversation, bounds a runaway row count. */
const MAX_THREAD_MESSAGES = 500;

serveAuthenticated('dashboard-assistant-conversations', async (req, user) => {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversation_id')?.trim();
  const sb = createServiceClient();

  const loadOwned = async (id: string) => {
    const { data, error } = await sb
      .from('ai_dashboard_assistant_conversations')
      .select(`${CONVERSATION_SUMMARY_COLUMNS}, user_id, organization_id`)
      .eq('id', id)
      .maybeSingle();
    if (error || !data || data.user_id !== user.id) return null;
    return data;
  };

  if (req.method === 'DELETE') {
    if (!conversationId) return jsonError(req, 'conversation_id is required', 400);
    const conversation = await loadOwned(conversationId);
    if (!conversation) return jsonError(req, 'Conversation not found', 404);

    try {
      await removeConversationAttachments({
        organizationId: conversation.organization_id as string,
        userId: user.id,
        conversationId,
      });
    } catch {
      // Storage cleanup is best-effort; messages cascade with the conversation row.
    }

    const { error: deleteError } = await sb
      .from('ai_dashboard_assistant_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', user.id);
    if (deleteError) {
      return jsonError(req, `Failed to delete conversation: ${deleteError.message}`, 500);
    }
    return jsonSuccess(req, { deleted: true });
  }

  if (req.method === 'PATCH') {
    if (!conversationId) return jsonError(req, 'conversation_id is required', 400);
    const parsed = parseConversationPatch(await readJsonBody(req));
    if (!parsed.ok) return jsonError(req, parsed.error, 400);
    if (!(await loadOwned(conversationId))) return jsonError(req, 'Conversation not found', 404);

    const { data, error } = await sb
      .from('ai_dashboard_assistant_conversations')
      .update({ ...parsed.patch, updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .select(CONVERSATION_SUMMARY_COLUMNS)
      .single();
    if (error) return jsonError(req, `Failed to update conversation: ${error.message}`, 500);
    return jsonSuccess(req, { conversation: data });
  }

  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  if (conversationId) {
    const conversation = await loadOwned(conversationId);
    if (!conversation) return jsonError(req, 'Conversation not found', 404);
    const { user_id: _user, organization_id: _org, ...summary } = conversation;

    const { data: messages, error: messagesError } = await sb
      .from('ai_dashboard_assistant_messages')
      .select('id, role, content_text, blocks, attachments, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(MAX_THREAD_MESSAGES);
    if (messagesError) {
      return jsonError(req, `Failed to load messages: ${messagesError.message}`, 500);
    }

    const assistantIds = (messages ?? [])
      .filter((row) => row.role === 'assistant')
      .map((row) => row.id as string);
    const feedback: Record<string, 1 | -1> = {};
    if (assistantIds.length > 0) {
      const { data: feedbackRows } = await sb
        .from('ai_dashboard_assistant_feedback')
        .select('message_id, rating')
        .eq('user_id', user.id)
        .in('message_id', assistantIds)
        .limit(MAX_THREAD_MESSAGES);
      for (const row of feedbackRows ?? []) {
        feedback[row.message_id as string] = row.rating === 1 ? 1 : -1;
      }
    }

    return jsonSuccess(req, { conversation: summary, messages: messages ?? [], feedback });
  }

  const orgSlug = readOrgSlugFromUrl(url);
  const orgId = readOrgIdFromUrl(url);
  if (!orgSlug && !orgId) {
    return jsonError(req, 'org_id or org_slug is required', 400);
  }
  const ctx = await resolveOrgAccessContext(req);
  const query = parseConversationListQuery(url.searchParams);

  let builder = sb
    .from('ai_dashboard_assistant_conversations')
    .select(CONVERSATION_SUMMARY_COLUMNS)
    .eq('organization_id', ctx.org.id)
    .eq('user_id', user.id);
  builder = query.archived
    ? builder.not('archived_at', 'is', null)
    : builder.is('archived_at', null);
  if (query.titlePattern) builder = builder.ilike('title', query.titlePattern);

  const { data: rows, error } = await builder
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('last_message_at', { ascending: false })
    .range(query.offset, query.offset + query.limit);
  if (error) {
    return jsonError(req, `Failed to load conversations: ${error.message}`, 500);
  }

  return jsonSuccess(req, pageResult(rows ?? [], query));
});
