/**
 * Map provider / platform errors to short host-facing copy.
 *
 * Twin of `ui/src/lib/feedback/toastMessages.ts` (`sanitizeToastMessage`). Keep the
 * busy/technical heuristics in sync so a Gemini quota dump never lands in
 * `error_message` columns or JSON `error` fields.
 */

export const HOST_FACING_GENERIC = 'Something went wrong. Try again.';
export const HOST_FACING_BUSY = 'This is busy right now. Try again in a moment.';
export const HOST_FACING_GENERATION_FAILED = 'Could not generate that. Try again.';

function messageFromUnknown(error: unknown): string {
  if (typeof error === 'string') return error.trim();
  if (error instanceof Error) return error.message.trim();
  return '';
}

function isTechnicalHostMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  const lower = text.toLowerCase();

  if (text.length > 140) return true;
  if (/https?:\/\//i.test(text)) return true;
  if (/\b[\w.-]+\.(com|dev|io|ai|google)\b/i.test(text)) return true;
  if (/\b(gemini-|veo-|gpt-|claude-|llama-)/i.test(text)) return true;
  if (
    /\b(googleapis|generativelanguage|resource_exhausted|quota exceeded|free_tier|rate[- ]limits?|retry in \d)/i.test(
      text
    )
  ) {
    return true;
  }
  if (/\b(api[_ ]?key|x-goog|token_count|input_token|output_token)\b/i.test(text)) return true;
  if (/\b(status|http)\s*[:=]?\s*\d{3}\b/i.test(text)) return true;
  if (/\(\d{3}\)/.test(text)) return true;
  if (/[{}[\]]/.test(text) && /[:"]/.test(text)) return true;
  if (/\bat\s+\S+\s+\(/.test(text)) return true;
  if (/\.(ts|js|tsx)(:\d+)/i.test(text)) return true;
  if (/\b(enoent|econnreset|pgrst|postgres|sqlstate|typeerror|referenceerror)\b/i.test(lower)) {
    return true;
  }
  if (/\b(deno\.|node:|supabase\/functions|stack trace)\b/i.test(lower)) return true;
  if (/^[a-z][a-z0-9_]+$/.test(text)) return true;
  if (/^(unauthorized|forbidden|bad request|internal server error|not found)(:|\s|$)/i.test(text)) {
    return true;
  }
  if (/\bmethod\s+[a-z]+\s+not allowed\b/i.test(text)) return true;
  return false;
}

function isProviderBusyMessage(lower: string): boolean {
  return (
    /\b(quota exceeded|resource_exhausted|free_tier|rate[- ]limits?|retry in \d)/i.test(lower) ||
    lower.includes('generativelanguage') ||
    lower.includes('googleapis.com')
  );
}

export function toHostFacingError(error: unknown, fallback = HOST_FACING_GENERIC): string {
  const text = messageFromUnknown(error);
  if (!text) return fallback;

  const lower = text.toLowerCase();

  if (
    lower.includes('no active session') ||
    lower.includes('please sign in') ||
    lower.includes('jwt')
  ) {
    return 'Please sign in again';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed')
  ) {
    return 'Network error. Check your connection';
  }
  if (
    lower === 'not allowed' ||
    lower.includes('you do not have permission') ||
    lower.includes('not allowed to')
  ) {
    return 'You do not have permission to do that';
  }
  if (isProviderBusyMessage(lower)) {
    return HOST_FACING_BUSY;
  }
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('took too long')) {
    return text.length <= 140 && !isTechnicalHostMessage(text)
      ? text
      : 'This took too long. Try again.';
  }
  if (lower.includes('not configured')) {
    return 'This is temporarily unavailable.';
  }
  if (isTechnicalHostMessage(text)) {
    return fallback;
  }
  return text;
}
