/**
 * Shared detection + messaging for anti-spam rejections from edge functions.
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 3 / Phase 5)
 *
 * Server envelopes:
 *   - CAPTCHA:    400 { success:false, error, captchaFailed:true }
 *   - Rate limit: 429 { success:false, error, retryAfterSec, rateLimited:true }  (+ Retry-After header)
 */

export type AntiSpamKind = 'captcha' | 'rate-limit' | null;

type MaybeEnvelope =
  | { captchaFailed?: unknown; rateLimited?: unknown; error?: unknown; retryAfterSec?: unknown }
  | null
  | undefined;

export function classifyAntiSpamFailure(status: number, json: MaybeEnvelope): AntiSpamKind {
  if (json && typeof json === 'object') {
    if ((json as { captchaFailed?: unknown }).captchaFailed === true) return 'captcha';
    if ((json as { rateLimited?: unknown }).rateLimited === true) return 'rate-limit';
  }
  if (status === 429) return 'rate-limit';
  return null;
}

export function isAntiSpamFailure(status: number, json: MaybeEnvelope): boolean {
  return classifyAntiSpamFailure(status, json) !== null;
}

/** User-facing copy. Kept minimal per DESIGN.md / minimal-ui-copy. */
export function antiSpamErrorMessage(status: number, json: MaybeEnvelope): string {
  const kind = classifyAntiSpamFailure(status, json);
  if (kind === 'captcha') {
    return 'Please complete the verification and try again.';
  }
  if (kind === 'rate-limit') {
    const retry =
      json &&
      typeof json === 'object' &&
      Number.isFinite(Number((json as { retryAfterSec?: unknown }).retryAfterSec))
        ? Number((json as { retryAfterSec?: number }).retryAfterSec)
        : 0;
    if (retry > 0 && retry <= 300) {
      const secs = Math.ceil(retry);
      return `Too many attempts. Try again in ${secs < 60 ? `${secs}s` : `${Math.ceil(secs / 60)} min`}.`;
    }
    return 'Too many attempts. Please wait a moment and try again.';
  }
  const serverMsg =
    json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string'
      ? ((json as { error: string }).error as string)
      : '';
  return serverMsg || 'Something went wrong. Please try again.';
}
