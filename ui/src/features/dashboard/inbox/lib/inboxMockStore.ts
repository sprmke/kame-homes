/**
 * In-memory mock inbox store — mutates during preview session only.
 */

import {
  filterMockConversations,
  MOCK_AUTOMATION,
  MOCK_AI_SUGGESTIONS,
  MOCK_CONNECTIONS,
  MOCK_CONVERSATIONS,
  MOCK_MESSAGES,
  MOCK_TEMPLATES,
} from '@/features/dashboard/inbox/lib/inboxMockData';
import type {
  ChatTemplateListItem,
  InboxAutomationSettings,
  InboxMessage,
  InboxTemplate,
  SaveInboxTemplatePayload,
  ThreadPlatformFilter,
  ThreadStatusFilter,
} from '@/features/dashboard/inbox/types/inbox';
import type { ChatTemplateSnapshot } from '@/components/chat/chatTemplateSnapshot';

let conversations = structuredClone(MOCK_CONVERSATIONS);
let messagesByConv = structuredClone(MOCK_MESSAGES);
let templates = structuredClone(MOCK_TEMPLATES);
let connections = structuredClone(MOCK_CONNECTIONS);
let automation = structuredClone(MOCK_AUTOMATION);

function delay(ms = 120): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function mockFetchConnections() {
  await delay();
  return {
    connections,
    metaConfigured: true,
    metaSyncInProgress: false,
    metaSyncError: null,
    metaHasMore: false,
    usingOrgMeta: true,
  };
}

export async function mockFetchThreads(filters: {
  status: ThreadStatusFilter;
  platform: ThreadPlatformFilter;
  search?: string;
}) {
  await delay();
  return {
    conversations: filterMockConversations(conversations, filters),
    nextCursor: null,
    metaHasMore: false,
    syncedFromMeta: false,
    syncedInChunk: undefined,
  };
}

export async function mockFetchMessages(conversationId: string) {
  await delay();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation) throw new Error('Conversation not found');
  return {
    conversation,
    messages: messagesByConv[conversationId] ?? [],
    hasMore: false,
  };
}

export async function mockMarkRead(conversationId: string) {
  await delay(60);
  conversations = conversations.map((c) =>
    c.id === conversationId ? { ...c, unread_count: 0 } : c
  );
}

export async function mockSendReply(conversationId: string, text: string, templateKey?: string) {
  await delay(200);
  const conv = conversations.find((c) => c.id === conversationId);
  if (!conv) throw new Error('Conversation not found');
  if (
    conv.conversation_type === 'dm' &&
    conv.messaging_window_expires_at &&
    new Date(conv.messaging_window_expires_at).getTime() <= Date.now()
  ) {
    throw new Error('Messaging window expired');
  }
  const now = new Date().toISOString();
  const template = templateKey ? mockChatTemplatePreview(templateKey) : null;
  const msg: InboxMessage = {
    id: `mock-out-${Date.now()}`,
    conversation_id: conversationId,
    direction: 'outbound',
    body_text: template ? template.name : text,
    attachments: [],
    sent_at: now,
    delivery_status: 'sent',
    is_ai_generated: false,
    ...(template ? { message_kind: 'template' as const, template_snapshot: template } : {}),
  };
  messagesByConv[conversationId] = [...(messagesByConv[conversationId] ?? []), msg];
  conversations = conversations.map((c) =>
    c.id === conversationId
      ? {
          ...c,
          subject_preview: text.slice(0, 500),
          last_message_at: now,
          reply_status: 'replied' as const,
          unread_count: 0,
        }
      : c
  );
}

export async function mockAiSuggest(conversationId: string) {
  await delay(400);
  return {
    suggestion:
      MOCK_AI_SUGGESTIONS[conversationId] ??
      MOCK_AI_SUGGESTIONS.default ??
      'Thanks for your message!',
    flagged: false,
  };
}

export async function mockFetchTemplates() {
  await delay();
  return templates.filter((t) => t.is_active);
}

export async function mockSaveTemplate(payload: SaveInboxTemplatePayload) {
  await delay();
  const platform = payload.platform ?? null;
  if (payload.id) {
    templates = templates.map((t) =>
      t.id === payload.id
        ? { ...t, title: payload.title, body_text: payload.bodyText, platform }
        : t
    );
    return templates.find((t) => t.id === payload.id)!;
  }
  const created: InboxTemplate = {
    id: `tpl-${Date.now()}`,
    title: payload.title,
    body_text: payload.bodyText,
    platform,
    conversation_type: 'all',
    sort_order: templates.length,
    is_active: true,
  };
  templates = [...templates, created];
  return created;
}

export async function mockDeleteTemplate(id: string) {
  await delay();
  templates = templates.filter((t) => t.id !== id);
}

export async function mockFetchAutomation() {
  await delay();
  return automation;
}

export async function mockPatchAutomation(patch: Partial<InboxAutomationSettings>) {
  await delay();
  automation = { ...automation, ...patch };
  return automation;
}

export async function mockConnectMeta(): Promise<string> {
  await delay();
  connections = connections.map((c) =>
    c.platform === 'facebook' || c.platform === 'instagram'
      ? { ...c, status: 'connected' as const }
      : c
  );
  return 'mock://connected';
}

export async function mockDisconnectMeta() {
  await delay();
  connections = connections.map((c) =>
    c.platform === 'facebook' || c.platform === 'instagram'
      ? { ...c, status: 'disconnected' as const, displayName: null }
      : c
  );
  const removedIds = new Set(
    conversations
      .filter((c) => c.platform === 'facebook' || c.platform === 'instagram')
      .map((c) => c.id)
  );
  conversations = conversations.filter(
    (c) => c.platform !== 'facebook' && c.platform !== 'instagram'
  );
  for (const id of removedIds) {
    delete messagesByConv[id];
  }
}

export function resetInboxMockStore() {
  connections = structuredClone(MOCK_CONNECTIONS);
  conversations = structuredClone(MOCK_CONVERSATIONS);
  messagesByConv = structuredClone(MOCK_MESSAGES);
  templates = structuredClone(MOCK_TEMPLATES);
  automation = structuredClone(MOCK_AUTOMATION);
}

export const MOCK_CHAT_TEMPLATES: ChatTemplateListItem[] = [
  {
    templateKey: 'house-rules',
    name: 'House Rules',
    category: 'standard',
    description: 'Quiet hours, visitors, and shared spaces.',
    sectionImageUrl: null,
    folderId: null,
    updatedAt: '2026-10-02T04:00:00.000Z',
  },
  {
    templateKey: 'check-in-instructions',
    name: 'Check-in Instructions',
    category: 'standard',
    description: 'Arrival steps and the unit access code.',
    sectionImageUrl: null,
    folderId: null,
    updatedAt: '2026-10-02T04:00:00.000Z',
  },
  {
    templateKey: 'custom-welcome',
    name: 'Welcome note',
    category: 'custom',
    description: 'Friendly arrival message with wifi and house tips.',
    sectionImageUrl: null,
    folderId: null,
    updatedAt: '2026-10-20T04:00:00.000Z',
  },
];

export async function mockFetchChatTemplates(): Promise<ChatTemplateListItem[]> {
  await delay();
  return structuredClone(MOCK_CHAT_TEMPLATES);
}

export function mockChatTemplatePreview(templateKey: string): ChatTemplateSnapshot {
  const item =
    MOCK_CHAT_TEMPLATES.find((template) => template.templateKey === templateKey) ??
    MOCK_CHAT_TEMPLATES[0]!;
  return {
    templateKey: item.templateKey,
    name: item.name,
    category: item.category,
    propertyId: 'mock-property',
    sectionImageUrl: null,
    html:
      item.templateKey === 'house-rules'
        ? '<h2>House rules</h2><p>Hi {{guest_name}}, here is a quick reminder for your stay.</p><ul><li>Quiet hours start at 10:00 PM.</li><li>Please keep the unit and hallway clean.</li><li>No smoking inside the unit.</li></ul>'
        : item.templateKey === 'check-in-instructions'
          ? '<h2>Check-in</h2><p>Hi {{guest_name}}, check-in starts at 2:00 PM.</p><p>Your unit is {{tower_and_unit_number}}. Message us when you arrive and we will meet you at the lobby.</p>'
          : '<p>Hi {{guest_name}}! Welcome to {{property_name}}. The wifi name and password are on the card by the TV. Message us anytime if you need help.</p>',
  };
}
