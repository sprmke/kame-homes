import type { AttachedContextItem } from '@/features/dashboard/ai-assistant/lib/attachedContext';

/**
 * Composer draft per conversation (text + pinned context), kept in sessionStorage so a
 * refresh, a mode switch or a tenant-shell remount never loses what the host was typing.
 * File attachments are not kept: they are large base64 payloads and are re-picked cheaply.
 */

export type AssistantDraft = {
  text: string;
  context: AttachedContextItem[];
};

export const EMPTY_ASSISTANT_DRAFT: AssistantDraft = { text: '', context: [] };

const PREFIX = 'kame-assistant-draft:';
const NEW_CONVERSATION_KEY = 'new';

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function safeSessionStorage(): DraftStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function assistantDraftKey(orgKey: string, conversationId: string | null): string {
  return `${PREFIX}${orgKey}:${conversationId ?? NEW_CONVERSATION_KEY}`;
}

function isDraft(value: unknown): value is AssistantDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<AssistantDraft>;
  return typeof draft.text === 'string' && Array.isArray(draft.context);
}

export function readAssistantDraft(
  key: string,
  storage: DraftStorage | undefined = safeSessionStorage()
): AssistantDraft {
  if (!storage) return EMPTY_ASSISTANT_DRAFT;
  try {
    const raw = storage.getItem(key);
    if (!raw) return EMPTY_ASSISTANT_DRAFT;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : EMPTY_ASSISTANT_DRAFT;
  } catch {
    return EMPTY_ASSISTANT_DRAFT;
  }
}

export function writeAssistantDraft(
  key: string,
  draft: AssistantDraft,
  storage: DraftStorage | undefined = safeSessionStorage()
): void {
  if (!storage) return;
  try {
    if (!draft.text.trim() && draft.context.length === 0) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, JSON.stringify(draft));
  } catch {
    // Quota / blocked storage: drafts are a convenience, never required.
  }
}

// ── Last active conversation per org ─────────────────────────────────────────────────────────
// Tenant switches remount AdminLayout (and the session provider). This restores the thread.

const ACTIVE_PREFIX = 'kame-assistant-active:';

export function readActiveConversationId(
  orgKey: string,
  storage: DraftStorage | undefined = safeSessionStorage()
): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(`${ACTIVE_PREFIX}${orgKey}`) || null;
  } catch {
    return null;
  }
}

export function writeActiveConversationId(
  orgKey: string,
  conversationId: string | null,
  storage: DraftStorage | undefined = safeSessionStorage()
): void {
  if (!storage) return;
  try {
    if (conversationId) storage.setItem(`${ACTIVE_PREFIX}${orgKey}`, conversationId);
    else storage.removeItem(`${ACTIVE_PREFIX}${orgKey}`);
  } catch {
    // ignore
  }
}
