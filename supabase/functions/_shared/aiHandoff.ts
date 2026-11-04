/**
 * Guest AI handoff state on a social conversation.
 *
 * The AI receptionist can pass a thread to the host team. While `ai_handoff_at` is set the AI
 * stays quiet on that thread, so a guest who asked for a person is not answered over by a bot.
 * The first human reply clears it.
 */

export const MAX_HANDOFF_REASON_CHARS = 300;

export type AiHandoffPatch = {
  /** Record a handoff with a short reason. */
  ai_handoff?: { reason: string } | null;
  /** A human replied: clear any handoff. Ignored when `ai_handoff` is also set. */
  clear_ai_handoff?: boolean;
};

/** Column updates for a conversation row. Empty when the patch does not touch handoff state. */
export function aiHandoffColumns(
  patch: AiHandoffPatch,
  now: Date = new Date()
): Record<string, unknown> {
  if (patch.ai_handoff) {
    const reason = patch.ai_handoff.reason
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_HANDOFF_REASON_CHARS);
    return { ai_handoff_at: now.toISOString(), ai_handoff_reason: reason || null };
  }
  if (patch.clear_ai_handoff) return { ai_handoff_at: null, ai_handoff_reason: null };
  return {};
}

/** True while a handoff is open on the thread; auto-replies must not send. */
export function isAutoReplyPausedByHandoff(conversation: {
  ai_handoff_at?: string | null;
}): boolean {
  return Boolean(conversation.ai_handoff_at);
}
