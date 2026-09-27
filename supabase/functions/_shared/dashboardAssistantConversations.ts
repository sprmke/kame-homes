/**
 * Pure helpers for `dashboard-assistant-conversations` (list paging, search, PATCH parsing).
 * Docs: docs/workflow/in-progress/ai-chat-mode.md (Phase 5, conversation management).
 */

export const CONVERSATION_PAGE_DEFAULT = 30;
export const CONVERSATION_PAGE_MAX = 50;
export const CONVERSATION_TITLE_MAX = 80;
const SEARCH_MAX = 80;

export const CONVERSATION_SUMMARY_COLUMNS =
  'id, title, property_id, last_message_at, created_at, pinned_at, archived_at';

export type ConversationListQuery = {
  offset: number;
  limit: number;
  /** Escaped ILIKE pattern, or null for no search. */
  titlePattern: string | null;
  archived: boolean;
};

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = raw == null ? Number.NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Escapes `%`, `_` and `\` so host search text is matched literally. */
export function escapeIlike(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function parseConversationListQuery(params: URLSearchParams): ConversationListQuery {
  const q = (params.get('q') ?? '').trim().slice(0, SEARCH_MAX);
  return {
    offset: clampInt(params.get('offset'), 0, 0, 10_000),
    limit: clampInt(params.get('limit'), CONVERSATION_PAGE_DEFAULT, 1, CONVERSATION_PAGE_MAX),
    titlePattern: q ? `%${escapeIlike(q)}%` : null,
    archived: params.get('archived') === 'true',
  };
}

/** One extra row is fetched to know whether another page exists. */
export function pageResult<T>(
  rows: T[],
  query: Pick<ConversationListQuery, 'offset' | 'limit'>
): { conversations: T[]; nextOffset: number | null } {
  const hasMore = rows.length > query.limit;
  return {
    conversations: hasMore ? rows.slice(0, query.limit) : rows,
    nextOffset: hasMore ? query.offset + query.limit : null,
  };
}

export type ConversationPatch = {
  title?: string;
  pinned_at?: string | null;
  archived_at?: string | null;
};

export function parseConversationPatch(
  body: Record<string, unknown>,
  now: Date = new Date()
): { ok: true; patch: ConversationPatch } | { ok: false; error: string } {
  const allowed = new Set(['title', 'pinned', 'archived']);
  const unknown = Object.keys(body).find((key) => !allowed.has(key));
  if (unknown) return { ok: false, error: `Unknown field: ${unknown}` };

  const patch: ConversationPatch = {};
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') return { ok: false, error: 'title must be a string' };
    const title = body.title.replace(/\s+/g, ' ').trim();
    if (!title) return { ok: false, error: 'title cannot be empty' };
    patch.title = title.slice(0, CONVERSATION_TITLE_MAX);
  }
  if (body.pinned !== undefined) {
    if (typeof body.pinned !== 'boolean') return { ok: false, error: 'pinned must be a boolean' };
    patch.pinned_at = body.pinned ? now.toISOString() : null;
  }
  if (body.archived !== undefined) {
    if (typeof body.archived !== 'boolean') {
      return { ok: false, error: 'archived must be a boolean' };
    }
    patch.archived_at = body.archived ? now.toISOString() : null;
    // Archiving unpins so the pinned section never shows archived threads.
    if (body.archived) patch.pinned_at = null;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'Nothing to update' };
  return { ok: true, patch };
}
