/**
 * Recover which tools earlier assistant turns used, so the router can keep follow-ups on topic.
 *
 * Prior turns reach the model as text snippets only, so the tool names are read from the
 * `latency_breakdown.tools_ms` column that every assistant message already persists.
 */

export type MessageWithBreakdown = {
  role: string;
  latency_breakdown?: unknown;
};

function toolNamesOf(breakdown: unknown): string[] {
  if (!breakdown || typeof breakdown !== 'object') return [];
  const tools = (breakdown as { tools_ms?: unknown }).tools_ms;
  if (!Array.isArray(tools)) return [];
  const names: string[] = [];
  for (const entry of tools) {
    const name = entry && typeof entry === 'object' ? (entry as { name?: unknown }).name : null;
    if (typeof name === 'string' && name.trim()) names.push(name.trim());
  }
  return names;
}

/** Oldest to newest, assistant rows only, capped to the last `limit` names. */
export function recentToolNamesFromMessages(
  messages: readonly MessageWithBreakdown[],
  limit = 12
): string[] {
  const names = messages
    .filter((row) => row.role === 'assistant')
    .flatMap((row) => toolNamesOf(row.latency_breakdown));
  return names.slice(-limit);
}
