import type { ChatTemplateSnapshot } from '@/components/chat/chatTemplateSnapshot';
import type {
  ChatTemplateListItem,
  InboxAutomationSettings,
  InboxConnection,
  InboxConversation,
  InboxMessage,
  InboxTemplate,
  MetaPagePickerOption,
  SaveInboxTemplatePayload,
  ThreadPlatformFilter,
  ThreadStatusFilter,
} from '@/features/dashboard/inbox/types/inbox';
import {
  scopedOrgFunctionsUrl,
  useOrgIdParam,
  useOrgSlugParam,
} from '@/features/dashboard/org/lib/adminApiScope';
import { throwIfAiQuota } from '@/features/dashboard/org/lib/aiQuotaToast';
import { throwIfFeatureUnavailableBody } from '@/lib/featureAvailability/featureUnavailableError';

import { supabase } from '@/lib/supabase/client';

async function getJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

type EdgeJson = {
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

/** Edge functions return `{ success, data }`; unwrap for typed fields. */
function unwrapEdgePayload(json: EdgeJson): Record<string, unknown> {
  if (!json.success) {
    throwIfFeatureUnavailableBody(json);
    throw new Error(json.error ?? 'Request failed');
  }
  const payload = json.data;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload;
  }
  return json;
}

function orgUrl(path: string, orgSlug: string | null, orgId: string | null): string {
  return scopedOrgFunctionsUrl(path, orgSlug, orgId);
}

/** Optional property/parking scope for inbox edge calls. */
export type InboxApiScope = {
  propertyId?: string | null;
  parkingId?: string | null;
};

function withInboxScope(url: string, scope?: InboxApiScope | null): string {
  if (!scope?.propertyId && !scope?.parkingId) return url;
  const u = new URL(url);
  if (scope.propertyId) u.searchParams.set('property_id', scope.propertyId);
  if (scope.parkingId) u.searchParams.set('parking_id', scope.parkingId);
  return u.toString();
}

function inboxScopeBody(scope?: InboxApiScope | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (scope?.propertyId) out.propertyId = scope.propertyId;
  if (scope?.parkingId) out.parkingId = scope.parkingId;
  return out;
}

export const INBOX_THREAD_PAGE_SIZE = 40;

export type InboxThreadsPageParam = string | { mode: 'sync'; cursor: string | null } | null;

export async function fetchInboxConnections(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null
): Promise<{
  connections: InboxConnection[];
  metaConfigured: boolean;
  metaSyncInProgress: boolean;
  metaSyncError: string | null;
  metaHasMore: boolean;
  metaSource?: 'org' | 'property' | 'parking';
  usingOrgMeta?: boolean;
}> {
  const jwt = await getJwt();
  const res = await fetch(withInboxScope(orgUrl('/meta-inbox-status', orgSlug, orgId), scope), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  return {
    connections: (payload.connections as InboxConnection[] | undefined) ?? [],
    metaConfigured: !!payload.metaConfigured,
    metaSyncInProgress: !!payload.metaSyncInProgress,
    metaSyncError: typeof payload.metaSyncError === 'string' ? payload.metaSyncError : null,
    metaHasMore: !!payload.metaHasMore,
    metaSource:
      payload.metaSource === 'property' || payload.metaSource === 'parking'
        ? payload.metaSource
        : 'org',
    usingOrgMeta: payload.usingOrgMeta === true,
  };
}

export async function startMetaInboxOAuth(
  orgSlug: string | null,
  orgId: string | null,
  returnPath: string,
  scope?: InboxApiScope | null
): Promise<string> {
  const jwt = await getJwt();
  const res = await fetch(
    withInboxScope(orgUrl('/meta-inbox-oauth-start', orgSlug, orgId), scope),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ returnPath, ...inboxScopeBody(scope) }),
    }
  );
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  if (typeof payload.url !== 'string') {
    throw new Error('Failed to start Meta connection');
  }
  return payload.url;
}

export async function disconnectMetaInbox(
  orgSlug: string | null,
  orgId: string | null,
  platform = 'meta',
  scope?: InboxApiScope | null,
  deleteMessages = true
): Promise<void> {
  const jwt = await getJwt();
  const res = await fetch(withInboxScope(orgUrl('/meta-inbox-disconnect', orgSlug, orgId), scope), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ platform, deleteMessages, ...inboxScopeBody(scope) }),
  });
  const json = (await res.json()) as EdgeJson;
  unwrapEdgePayload(json);
}

export async function resubscribeMetaInbox(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null
): Promise<{ verified: boolean; resubscribed: boolean }> {
  const jwt = await getJwt();
  const res = await fetch(
    withInboxScope(orgUrl('/meta-inbox-resubscribe', orgSlug, orgId), scope),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(inboxScopeBody(scope)),
    }
  );
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  return {
    verified: payload.verified === true,
    resubscribed: payload.resubscribed === true,
  };
}

export async function fetchMetaOAuthPages(
  orgSlug: string | null,
  orgId: string | null,
  pickerState: string
): Promise<MetaPagePickerOption[]> {
  const jwt = await getJwt();
  const base = orgUrl('/meta-inbox-oauth-pages', orgSlug, orgId);
  const res = await fetch(`${base}&picker=${encodeURIComponent(pickerState)}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  return (payload.pages as MetaPagePickerOption[] | undefined) ?? [];
}

export async function completeMetaOAuthPage(
  orgSlug: string | null,
  orgId: string | null,
  pickerState: string,
  pageId: string,
  scope?: InboxApiScope | null
): Promise<{ pageName: string }> {
  const jwt = await getJwt();
  const res = await fetch(orgUrl('/meta-inbox-oauth-complete', orgSlug, orgId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pickerState, pageId, ...inboxScopeBody(scope) }),
  });
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  return { pageName: typeof payload.pageName === 'string' ? payload.pageName : '' };
}

export type MetaBackfillChunkPhase = 'messenger' | 'instagram';

export type MetaBackfillChunkResult = {
  done: boolean;
  phase: MetaBackfillChunkPhase | 'complete';
  nextUrl: string | null;
  syncedInChunk: number;
  metaHasMore: boolean;
};

export async function runMetaInboxBackfillChunk(
  orgSlug: string | null,
  orgId: string | null,
  state?: {
    phase?: MetaBackfillChunkPhase;
    nextUrl?: string | null;
    finalize?: boolean;
    light?: boolean;
  },
  scope?: InboxApiScope | null
): Promise<MetaBackfillChunkResult> {
  const jwt = await getJwt();
  const res = await fetch(orgUrl('/meta-inbox-backfill', orgSlug, orgId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phase: state?.phase ?? 'messenger',
      nextUrl: state?.nextUrl ?? null,
      finalize: state?.finalize === true,
      light: state?.light === true,
      ...inboxScopeBody(scope),
    }),
  });
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  return {
    done: !!payload.done,
    phase:
      payload.phase === 'instagram' || payload.phase === 'messenger' || payload.phase === 'complete'
        ? (payload.phase as MetaBackfillChunkResult['phase'])
        : 'complete',
    nextUrl: typeof payload.nextUrl === 'string' ? payload.nextUrl : null,
    syncedInChunk: typeof payload.syncedInChunk === 'number' ? payload.syncedInChunk : 0,
    metaHasMore: !!payload.metaHasMore,
  };
}

export async function fetchInboxThreads(
  orgSlug: string | null,
  orgId: string | null,
  filters: {
    status: ThreadStatusFilter;
    platform: ThreadPlatformFilter;
    search?: string;
    cursor?: string | null;
  },
  scope?: InboxApiScope | null
): Promise<{
  conversations: InboxConversation[];
  nextCursor: string | null;
  metaHasMore: boolean;
}> {
  const jwt = await getJwt();
  const params = new URLSearchParams();
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.platform !== 'all') params.set('platform', filters.platform);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.cursor) params.set('cursor', filters.cursor);
  params.set('limit', String(INBOX_THREAD_PAGE_SIZE));
  const qs = params.toString();
  const base = withInboxScope(orgUrl('/social-inbox-threads', orgSlug, orgId), scope);
  const res = await fetch(qs ? `${base}&${qs}` : base, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  return {
    conversations: (payload.conversations as InboxConversation[] | undefined) ?? [],
    nextCursor: (payload.nextCursor as string | null | undefined) ?? null,
    metaHasMore: !!payload.metaHasMore,
  };
}

export async function fetchInboxMessages(
  orgSlug: string | null,
  orgId: string | null,
  conversationId: string,
  before?: string,
  scope?: InboxApiScope | null
): Promise<{ conversation: InboxConversation; messages: InboxMessage[]; hasMore: boolean }> {
  const jwt = await getJwt();
  const base = withInboxScope(orgUrl('/social-inbox-messages', orgSlug, orgId), scope);
  const params = new URLSearchParams({ conversation_id: conversationId });
  if (before) params.set('before', before);
  const res = await fetch(`${base}&${params.toString()}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  return {
    conversation: payload.conversation as InboxConversation,
    messages: (payload.messages as InboxMessage[] | undefined) ?? [],
    hasMore: !!payload.hasMore,
  };
}

export async function markInboxConversationRead(
  orgSlug: string | null,
  orgId: string | null,
  conversationId: string,
  scope?: InboxApiScope | null
): Promise<void> {
  const jwt = await getJwt();
  const base = withInboxScope(orgUrl('/social-inbox-messages', orgSlug, orgId), scope);
  await fetch(`${base}&conversation_id=${encodeURIComponent(conversationId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
  });
}

export async function sendInboxReply(
  orgSlug: string | null,
  orgId: string | null,
  conversationId: string,
  text: string,
  opts?: {
    replyToMessageId?: string;
    useHumanAgentTag?: boolean;
    attachments?: Array<{ kind: 'image' | 'file'; url: string; label?: string }>;
    templateKey?: string;
    bookingId?: string | null;
    scope?: InboxApiScope | null;
  }
): Promise<void> {
  const jwt = await getJwt();
  const scope = opts?.scope;
  const res = await fetch(withInboxScope(orgUrl('/social-inbox-send', orgSlug, orgId), scope), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      text,
      replyToMessageId: opts?.replyToMessageId,
      useHumanAgentTag: opts?.useHumanAgentTag === true,
      attachments: opts?.attachments,
      templateKey: opts?.templateKey,
      bookingId: opts?.bookingId ?? undefined,
      ...inboxScopeBody(scope),
    }),
  });
  const json = (await res.json()) as EdgeJson;
  unwrapEdgePayload(json);
}

/** Property templates available in the Inbox composer (email templates excluded). */
export async function listChatTemplates(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null
): Promise<ChatTemplateListItem[]> {
  const jwt = await getJwt();
  const res = await fetch(withInboxScope(orgUrl('/chat-templates', orgSlug, orgId), scope), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  return (payload.templates as ChatTemplateListItem[] | undefined) ?? [];
}

/** Rendered template preview, with the conversation's guest/booking placeholders filled. */
export async function fetchChatTemplatePreview(
  orgSlug: string | null,
  orgId: string | null,
  scope: InboxApiScope | null | undefined,
  templateKey: string,
  opts?: { conversationId?: string | null; bookingId?: string | null }
): Promise<ChatTemplateSnapshot> {
  const jwt = await getJwt();
  const url = new URL(withInboxScope(orgUrl('/chat-templates', orgSlug, orgId), scope));
  url.searchParams.set('template_key', templateKey);
  if (opts?.conversationId) url.searchParams.set('conversation_id', opts.conversationId);
  if (opts?.bookingId) url.searchParams.set('booking_id', opts.bookingId);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${jwt}` } });
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  const snapshot = payload.snapshot as ChatTemplateSnapshot | undefined;
  if (!snapshot) throw new Error('Template preview failed');
  return snapshot;
}

/** Scoped `social-inbox-send` URL — for the offline outbox, which needs a concrete URL. */
export function inboxSendUrl(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null
): string {
  return withInboxScope(orgUrl('/social-inbox-send', orgSlug, orgId), scope);
}

/** Request body for a text reply (no attachments) — used by the offline outbox. */
export function inboxSendBody(
  input: {
    conversationId: string;
    text: string;
    replyToMessageId?: string;
    useHumanAgentTag?: boolean;
  },
  scope?: InboxApiScope | null
): Record<string, unknown> {
  return {
    conversationId: input.conversationId,
    text: input.text,
    replyToMessageId: input.replyToMessageId,
    useHumanAgentTag: input.useHumanAgentTag === true,
    ...inboxScopeBody(scope),
  };
}

export async function editInboxMessage(
  orgSlug: string | null,
  orgId: string | null,
  conversationId: string,
  messageId: string,
  text: string,
  scope?: InboxApiScope | null
): Promise<InboxMessage> {
  const jwt = await getJwt();
  const base = withInboxScope(orgUrl('/social-inbox-messages', orgSlug, orgId), scope);
  const params = new URLSearchParams({ conversation_id: conversationId });
  const res = await fetch(`${base}&${params.toString()}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messageId, text, ...inboxScopeBody(scope) }),
  });
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  return payload.message as InboxMessage;
}

export async function unsendInboxMessage(
  orgSlug: string | null,
  orgId: string | null,
  conversationId: string,
  messageId: string,
  scope?: InboxApiScope | null
): Promise<void> {
  const jwt = await getJwt();
  const base = withInboxScope(orgUrl('/social-inbox-messages', orgSlug, orgId), scope);
  const params = new URLSearchParams({ conversation_id: conversationId });
  const res = await fetch(`${base}&${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'unsend', messageId, ...inboxScopeBody(scope) }),
  });
  const json = (await res.json()) as EdgeJson;
  unwrapEdgePayload(json);
}

export async function fetchInboxTemplates(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null
): Promise<InboxTemplate[]> {
  const jwt = await getJwt();
  const res = await fetch(
    withInboxScope(orgUrl('/social-inbox-templates', orgSlug, orgId), scope),
    {
      headers: { Authorization: `Bearer ${jwt}` },
    }
  );
  const json = (await res.json()) as EdgeJson;
  const payload = unwrapEdgePayload(json);
  return (payload.templates as InboxTemplate[] | undefined) ?? [];
}

export async function saveInboxTemplate(
  orgSlug: string | null,
  orgId: string | null,
  payload: SaveInboxTemplatePayload,
  scope?: InboxApiScope | null
): Promise<InboxTemplate> {
  const jwt = await getJwt();
  const method = payload.id ? 'PATCH' : 'POST';
  const res = await fetch(
    withInboxScope(orgUrl('/social-inbox-templates', orgSlug, orgId), scope),
    {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, ...inboxScopeBody(scope) }),
    }
  );
  const json = (await res.json()) as EdgeJson;
  const data = unwrapEdgePayload(json);
  return data.template as InboxTemplate;
}

export async function deleteInboxTemplate(
  orgSlug: string | null,
  orgId: string | null,
  id: string,
  scope?: InboxApiScope | null
): Promise<void> {
  const jwt = await getJwt();
  const base = withInboxScope(orgUrl('/social-inbox-templates', orgSlug, orgId), scope);
  const res = await fetch(`${base}&id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = (await res.json()) as EdgeJson;
  unwrapEdgePayload(json);
}

export async function suggestInboxAiReply(
  orgSlug: string | null,
  orgId: string | null,
  conversationId: string,
  scope?: InboxApiScope | null
): Promise<{ suggestion: string; flagged: boolean }> {
  const jwt = await getJwt();
  const res = await fetch(
    withInboxScope(orgUrl('/social-inbox-ai-suggest', orgSlug, orgId), scope),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId, ...inboxScopeBody(scope) }),
    }
  );
  const json = (await res.json()) as EdgeJson;
  throwIfAiQuota(json, res);
  const payload = unwrapEdgePayload(json);
  if (typeof payload.suggestion !== 'string') {
    throw new Error('AI suggestion unavailable');
  }
  return {
    suggestion: payload.suggestion,
    flagged: payload.flagged === true,
  };
}

function parseAutomationSettings(payload: Record<string, unknown>): InboxAutomationSettings {
  return {
    autoReplyEnabled: !!payload.autoReplyEnabled,
    autoReplyMode:
      payload.autoReplyMode === 'send' || payload.autoReplyMode === 'draft'
        ? payload.autoReplyMode
        : 'draft',
    aiSystemPrompt: typeof payload.aiSystemPrompt === 'string' ? payload.aiSystemPrompt : '',
    platformToggles:
      payload.platformToggles && typeof payload.platformToggles === 'object'
        ? (payload.platformToggles as InboxAutomationSettings['platformToggles'])
        : {},
    aiAvailable: payload.aiAvailable === true,
    aiError: typeof payload.aiError === 'string' ? payload.aiError : null,
  };
}

export async function fetchInboxAutomationSettings(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null
): Promise<InboxAutomationSettings> {
  const jwt = await getJwt();
  const res = await fetch(withInboxScope(orgUrl('/social-inbox-settings', orgSlug, orgId), scope), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = (await res.json()) as EdgeJson;
  return parseAutomationSettings(unwrapEdgePayload(json));
}

export async function patchInboxAutomationSettings(
  orgSlug: string | null,
  orgId: string | null,
  patch: Partial<InboxAutomationSettings>,
  scope?: InboxApiScope | null
): Promise<InboxAutomationSettings> {
  const jwt = await getJwt();
  const res = await fetch(withInboxScope(orgUrl('/social-inbox-settings', orgSlug, orgId), scope), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...patch, ...inboxScopeBody(scope) }),
  });
  const json = (await res.json()) as EdgeJson;
  throwIfAiQuota(json, res);
  return parseAutomationSettings(unwrapEdgePayload(json));
}

export function useInboxOrgScope() {
  return { orgSlug: useOrgSlugParam(), orgId: useOrgIdParam() };
}
