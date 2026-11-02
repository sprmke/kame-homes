/**
 * One-call anti-spam gate for public + lightly-authenticated write handlers.
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
 *
 * Composes the three layers — bot heuristics → CAPTCHA → durable rate limit — and
 * returns a ready-to-send `Response` (with CORS headers + the standard error
 * envelope, carrying `captchaFailed` / `rateLimited` flags the UI keys off) when
 * the caller should be blocked, or `null` when they pass.
 *
 * Works from both `servePublic` handlers and the raw-`serve()` ones
 * (`submit-form`, `submit-sd-form`, `submit-pay-parking`) whose catch blocks do
 * not special-case thrown `Response`s — every handler just does:
 *
 *   const blocked = await antiSpamGate(req, body, { scope: 'submit-form', rateLimit: { limit: 20, windowSec: 60 } });
 *   if (blocked) return blocked;
 *
 * Ordering rationale: heuristics first (free, no IO), then CAPTCHA (network), then
 * the rate-limit bump (one RPC) so a spammer who trips the honeypot never costs
 * us a siteverify call or a counter write.
 */

import { corsHeaders } from './cors.ts';
import { resolveCaptchaMode, verifyCaptchaToken, readCaptchaToken } from './captcha.ts';
import { checkBotHeuristics } from './botHeuristics.ts';
import { checkRateLimit, identityFromRequest } from './rateLimit.ts';
import { clientIpFromRequest } from './publicRateLimit.ts';
import { logEvent, resolveRequestId } from './requestLog.ts';

type BodyLike = Record<string, unknown> | FormData | URLSearchParams;

export type AntiSpamOptions = {
  /** Logical form name — the CAPTCHA `action` and the rate-limit scope. */
  scope: string;
  /** Authenticated user, when the handler has one — sharpens the rate-limit key. */
  user?: { id?: string | null } | null;
  /** Durable rate limit. Omit to skip the counter entirely for this route. */
  rateLimit?: { limit: number; windowSec: number };
  /** CAPTCHA. Defaults to on; set `false` for lightly-authed routes behind the auth wall. */
  captcha?: boolean;
  /** Bot heuristics. Defaults to on; tune the min-fill time per form. */
  heuristics?: boolean | { minElapsedMs?: number };
};

function blockedResponse(
  req: Request,
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', ...(extraHeaders ?? {}) },
  });
}

export async function antiSpamGate(
  req: Request,
  body: BodyLike,
  options: AntiSpamOptions
): Promise<Response | null> {
  const { scope } = options;

  // 1. Heuristics — free, first.
  if (options.heuristics !== false) {
    const tuning = typeof options.heuristics === 'object' ? options.heuristics : {};
    const heur = checkBotHeuristics(body, { minElapsedMs: tuning.minElapsedMs });
    if (!heur.ok) {
      // A heuristic block is the system working: expected, frequent, and not a fault.
      // Sending it as an exception buried real errors and billed for the privilege.
      logEvent('warn', {
        fn: `antispam:${scope}`,
        requestId: resolveRequestId(req),
        event: 'antispam_heuristic_block',
        meta: { reason: heur.reason },
      });
      // Deliberately vague to the client — don't teach a bot which check tripped.
      return blockedResponse(
        req,
        { success: false, error: 'Your submission could not be processed. Please try again.' },
        400
      );
    }
  }

  // 2. CAPTCHA.
  if (options.captcha !== false && resolveCaptchaMode() !== 'disabled') {
    const result = await verifyCaptchaToken(readCaptchaToken(body), {
      remoteIp: clientIpFromRequest(req),
      expectedAction: scope,
    });
    if (!result.ok) {
      return blockedResponse(
        req,
        {
          success: false,
          error: result.reason ?? 'Human verification failed. Please retry.',
          captchaFailed: true,
        },
        400
      );
    }
  }

  // 3. Durable rate limit.
  if (options.rateLimit) {
    const decision = await checkRateLimit({
      scope,
      identity: identityFromRequest(req, options.user),
      limit: options.rateLimit.limit,
      windowSec: options.rateLimit.windowSec,
    });
    if (!decision.allowed) {
      return blockedResponse(
        req,
        {
          success: false,
          error: 'Too many requests. Please wait a moment and try again.',
          retryAfterSec: decision.retryAfterSec,
          rateLimited: true,
        },
        429,
        { 'Retry-After': String(decision.retryAfterSec) }
      );
    }
  }

  return null;
}
