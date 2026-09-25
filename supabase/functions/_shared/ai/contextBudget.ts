/**
 * Context-window budgeting for multi-round tool calling. Tool results and prior turns are the
 * unbounded parts of an agent prompt; these helpers keep what the model sees inside a predictable
 * token budget. Server-side grounding still uses the full, unbounded tool data.
 *
 * Token counts are estimates (≈4 chars per token, fixed cost per inline image), good enough for
 * budgeting; billing always uses the provider's reported usage.
 */
import type { GeminiContent } from './llmTools.ts';

/** Max JSON chars of one tool result sent back to the model. */
export const TOOL_RESULT_MAX_CHARS = 12_000;
/** Gemini bills an inline image at a flat rate; attachments dominate otherwise. */
const INLINE_DATA_TOKENS = 258;
const CHARS_PER_TOKEN = 4;
const TRUNCATED_STRING_CHARS = 280;

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

export function estimateTokens(value: unknown): number {
  return Math.ceil(safeStringify(value).length / CHARS_PER_TOKEN);
}

export function estimateHistoryTokens(history: GeminiContent[]): number {
  let tokens = 0;
  for (const content of history) {
    for (const part of content.parts) {
      tokens += 'inlineData' in part ? INLINE_DATA_TOKENS : estimateTokens(part);
    }
  }
  return tokens;
}

/** Keeps the first `limit` items of every array, appending a marker the model can read. */
function trimArrays(value: unknown, limit: number): unknown {
  if (Array.isArray(value)) {
    const kept = value.slice(0, limit).map((item) => trimArrays(item, limit));
    return value.length > limit
      ? [...kept, { _truncated: `${value.length - limit} more items omitted` }]
      : kept;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, trimArrays(v, limit)])
    );
  }
  return value;
}

function clipStrings(value: unknown, maxChars: number): unknown {
  if (typeof value === 'string') {
    return value.length > maxChars ? `${value.slice(0, maxChars)}…` : value;
  }
  if (Array.isArray(value)) return value.map((item) => clipStrings(item, maxChars));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        clipStrings(v, maxChars),
      ])
    );
  }
  return value;
}

/**
 * Shrinks a tool result to at most `maxChars` of JSON while keeping it structured: first by
 * trimming long lists (halving the kept item count), then by clipping long strings, and only as a
 * last resort by returning a clipped JSON preview.
 */
export function boundToolResult(value: unknown, maxChars = TOOL_RESULT_MAX_CHARS): unknown {
  if (safeStringify(value).length <= maxChars) return value;
  for (let limit = 50; limit >= 1; limit = Math.floor(limit / 2)) {
    const trimmed = trimArrays(value, limit);
    if (safeStringify(trimmed).length <= maxChars) return trimmed;
  }
  const clipped = clipStrings(trimArrays(value, 1), TRUNCATED_STRING_CHARS);
  const clippedJson = safeStringify(clipped);
  if (clippedJson.length <= maxChars) return clipped;
  return {
    _truncated: 'Result too large; showing a preview',
    preview: clippedJson.slice(0, maxChars),
  };
}

/**
 * Drops the oldest turns until the history fits `maxTokens`. Never splits a model function call
 * from its response: the kept window always starts on a plain user turn.
 */
export function fitHistoryToTokenBudget(
  history: GeminiContent[],
  maxTokens: number
): GeminiContent[] {
  let start = 0;
  let total = estimateHistoryTokens(history);
  const startsCleanly = (i: number) =>
    history[i]?.role === 'user' && !history[i].parts.some((p) => 'functionResponse' in p);
  while (start < history.length && (total > maxTokens || !startsCleanly(start))) {
    total -= estimateHistoryTokens([history[start]]);
    start += 1;
  }
  return history.slice(start);
}
