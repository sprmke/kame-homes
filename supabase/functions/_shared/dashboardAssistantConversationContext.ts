/**
 * Prior-turn context for the AI dashboard assistant.
 * Loads recent messages, builds a short rolling summary, and maps turns into Gemini history.
 */

import type { GeminiContent } from './ai/llmTools.ts';
import { recentToolNamesFromMessages } from './ai/agent/toolHistory.ts';
import {
  capEntityRefs,
  dedupeEntityRefs,
  formatKnownFactsSection,
  parseEntityRefs,
  type EntityRef,
} from './dashboardAssistantEntityRefs.ts';

export type ConversationMessageRow = {
  id: string;
  role: string;
  content_text: string | null;
  blocks?: unknown;
  attachments?: unknown;
  created_at?: string;
  latency_breakdown?: unknown;
  entity_refs?: unknown;
};

const MAX_PRIOR_MESSAGES = 16;
const MAX_SUMMARY_CHARS = 1800;
const MAX_ASSISTANT_SNIPPET = 320;

function asText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

/** Pull a short host-readable snippet from persisted assistant blocks. */
export function assistantBlocksToSnippet(blocks: unknown): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const rec = block as Record<string, unknown>;
    if (rec.type === 'text' && asText(rec.text)) {
      parts.push(asText(rec.text));
    } else if (rec.type === 'action_confirmation' && asText(rec.summary)) {
      parts.push(asText(rec.summary));
    } else if (rec.type === 'stepper' && asText(rec.title)) {
      parts.push(asText(rec.title));
    } else if (rec.type === 'stat_list' && asText(rec.title)) {
      parts.push(asText(rec.title));
    } else if (rec.type === 'data_table' && asText(rec.title)) {
      parts.push(asText(rec.title));
    } else if (rec.type === 'flow') {
      const title = asText(rec.title);
      if (title) {
        parts.push(title);
      } else if (Array.isArray(rec.steps) && rec.steps.length > 0) {
        parts.push(asText(rec.steps[0]));
      }
    } else if (rec.type === 'diagram') {
      const title = asText(rec.title);
      if (title) parts.push(title);
      else if (asText(rec.source)) parts.push('Shared a diagram');
    } else if (rec.type === 'map') {
      const label = asText(rec.label);
      if (label) parts.push(`Location: ${label}`);
      else if (asText(rec.href)) parts.push(asText(rec.href));
    } else if (
      (rec.type === 'chart' ||
        rec.type === 'calendar' ||
        rec.type === 'timeline' ||
        rec.type === 'carousel' ||
        rec.type === 'comparison' ||
        rec.type === 'checklist' ||
        rec.type === 'kpi') &&
      asText(rec.title ?? rec.label)
    ) {
      parts.push(asText(rec.title ?? rec.label));
    } else if (rec.type === 'entity_card' && asText(rec.title)) {
      parts.push(asText(rec.title));
    } else if (rec.type === 'callout' && asText(rec.text)) {
      parts.push(asText(rec.text));
    } else if (rec.type === 'booking_card') {
      const guest = asText(rec.guestName) || 'Guest';
      const status = asText(rec.status);
      parts.push(status ? `${guest} (${status})` : guest);
    } else if (rec.type === 'quick_actions' && Array.isArray(rec.actions)) {
      const labels = (rec.actions as Array<{ label?: string }>)
        .map((action) => asText(action.label))
        .filter(Boolean)
        .slice(0, 3);
      if (labels.length) parts.push(`Suggested: ${labels.join('; ')}`);
    }
    if (parts.join(' ').length >= MAX_ASSISTANT_SNIPPET) break;
  }
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (joined.length <= MAX_ASSISTANT_SNIPPET) return joined;
  return `${joined.slice(0, MAX_ASSISTANT_SNIPPET - 1)}…`;
}

function messageSnippet(row: ConversationMessageRow): string {
  if (row.role === 'user') {
    const text = asText(row.content_text);
    const attachmentNote = attachmentPathsNote(row.attachments);
    if (text && attachmentNote) return `${text}\n${attachmentNote}`;
    return text || attachmentNote;
  }
  const fromText = asText(row.content_text);
  if (fromText) {
    return fromText.length <= MAX_ASSISTANT_SNIPPET
      ? fromText
      : `${fromText.slice(0, MAX_ASSISTANT_SNIPPET - 1)}…`;
  }
  return assistantBlocksToSnippet(row.blocks);
}

function attachmentPathsNote(attachments: unknown): string {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  const lines: string[] = [];
  for (const item of attachments) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = asText(rec.name) || 'file';
    const path = asText(rec.path);
    const mime = asText(rec.mimeType);
    if (!path) continue;
    lines.push(`Attached earlier: ${name}${mime ? ` (${mime})` : ''} - attachmentPath: ${path}`);
  }
  return lines.join('\n');
}

/**
 * Deterministic rolling summary of recent turns — no extra model call.
 * Keeps guest names, statuses, and decisions the host already saw.
 */
export function buildConversationSummary(messages: ConversationMessageRow[]): string {
  if (messages.length === 0) return '';
  const lines: string[] = [];
  for (const row of messages) {
    const snippet = messageSnippet(row);
    if (!snippet) continue;
    const who = row.role === 'user' ? 'Host' : 'Assistant';
    lines.push(`${who}: ${snippet}`);
  }
  let summary = lines.join('\n');
  if (summary.length > MAX_SUMMARY_CHARS) {
    summary = `…\n${summary.slice(summary.length - MAX_SUMMARY_CHARS + 2)}`;
  }
  return summary;
}

/** Map prior DB turns into Gemini chat history (user/model text only). */
export function priorMessagesToGeminiHistory(messages: ConversationMessageRow[]): GeminiContent[] {
  const history: GeminiContent[] = [];
  for (const row of messages) {
    const snippet = messageSnippet(row);
    if (!snippet) continue;
    const role = row.role === 'user' ? 'user' : row.role === 'assistant' ? 'model' : null;
    if (!role) continue;
    const last = history[history.length - 1];
    if (last && last.role === role) {
      const prev =
        last.parts[0] && typeof last.parts[0] === 'object' && 'text' in last.parts[0]
          ? String((last.parts[0] as { text?: string }).text ?? '')
          : '';
      last.parts = [{ text: `${prev}\n${snippet}`.trim() }];
      continue;
    }
    history.push({ role, parts: [{ text: snippet }] });
  }
  // Gemini requires history to start with a user turn when present.
  while (history.length > 0 && history[0].role !== 'user') {
    history.shift();
  }
  return history;
}

export type LoadedConversationContext = {
  summary: string;
  priorHistory: GeminiContent[];
  recentMessages: ConversationMessageRow[];
  /** Tool names used by this conversation's recent turns, oldest first — the router's follow-up
   * signal. Prior turns reach the model as text only, so this is read from each assistant
   * message's persisted `latency_breakdown.tools_ms`, not from the Gemini history. */
  recentToolNames: string[];
  /** Phase 4 working memory: prompt-ready "Known from earlier in this chat" section built from
   * recent turns' persisted `entity_refs`. Empty string when nothing to carry forward. */
  knownFactsText: string;
  /** Phase 4 resumable turns: the most recent assistant message's unfinished `task_plan` block
   * steps, when the last turn ended with open goals — null otherwise. Lets the "Continue" chip
   * seed `TurnTaskPlanRecorder#resumeFrom` instead of starting goal-planning over. */
  resumablePlanSteps: Array<{
    id: string;
    label: string;
    status: 'pending' | 'running' | 'done' | 'failed';
  }> | null;
};

type PersistedTaskPlanBlock = {
  type: 'task_plan';
  steps?: Array<{ id?: unknown; label?: unknown; status?: unknown }>;
};

function isPersistedTaskPlanBlock(block: unknown): block is PersistedTaskPlanBlock {
  return (
    !!block &&
    typeof block === 'object' &&
    (block as { type?: unknown }).type === 'task_plan' &&
    Array.isArray((block as { steps?: unknown }).steps)
  );
}

const OPEN_STATUSES = new Set(['pending', 'running']);

/** The last assistant turn's `task_plan` block, if it left any step unfinished. */
export function openPlanStepsFromLastAssistantMessage(
  messages: readonly ConversationMessageRow[]
): LoadedConversationContext['resumablePlanSteps'] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const row = messages[i];
    if (row?.role !== 'assistant') continue;
    const blocks = Array.isArray(row.blocks) ? row.blocks : [];
    const planBlock = blocks.find(isPersistedTaskPlanBlock);
    if (!planBlock) return null;
    const steps = (planBlock.steps ?? [])
      .filter(
        (s): s is { id: string; label: string; status: string } =>
          typeof s.id === 'string' && typeof s.label === 'string' && typeof s.status === 'string'
      )
      .map((s) => ({
        id: s.id,
        label: s.label,
        status: (OPEN_STATUSES.has(s.status)
          ? 'pending'
          : s.status === 'done'
            ? 'done'
            : 'failed') as 'pending' | 'done' | 'failed',
      }));
    const hasOpen = steps.some((s) => s.status !== 'done');
    return hasOpen ? steps : null;
  }
  return null;
}

/** Flattens recent turns' `entity_refs`, freshest mention of each entity wins, capped. */
export function collectKnownFacts(messages: readonly ConversationMessageRow[]): EntityRef[] {
  const all = messages.flatMap((row) => parseEntityRefs(row.entity_refs));
  return capEntityRefs(dedupeEntityRefs(all));
}

/**
 * Load prior messages for this conversation (excludes the current user row when provided).
 */
export async function loadConversationContext(
  // deno-lint-ignore no-explicit-any
  sb: any,
  conversationId: string,
  options?: { excludeMessageId?: string | null }
): Promise<LoadedConversationContext> {
  const { data, error } = await sb
    .from('ai_dashboard_assistant_messages')
    .select(
      'id, role, content_text, blocks, attachments, created_at, latency_breakdown, entity_refs'
    )
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MAX_PRIOR_MESSAGES + 4);

  if (error) {
    throw new Error(`Failed to load conversation context: ${error.message}`);
  }

  const excludeId = options?.excludeMessageId ?? null;
  const recent = ((data ?? []) as ConversationMessageRow[])
    .filter((row) => !excludeId || row.id !== excludeId)
    .reverse()
    .slice(-MAX_PRIOR_MESSAGES);

  return {
    summary: buildConversationSummary(recent),
    priorHistory: priorMessagesToGeminiHistory(recent),
    recentMessages: recent,
    recentToolNames: recentToolNamesFromMessages(recent),
    knownFactsText: formatKnownFactsSection(collectKnownFacts(recent)),
    resumablePlanSteps: openPlanStepsFromLastAssistantMessage(recent),
  };
}

/** System-prompt appendix so the model reuses prior thread context. */
export function conversationContextPromptSection(summary: string): string {
  if (!summary.trim()) return '';
  return `\n\nConversation so far (use for continuity, do not contradict prior facts unless a newer tool result updates them):\n${summary}`;
}
