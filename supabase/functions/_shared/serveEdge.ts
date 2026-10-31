import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { type AdminUser, verifyAdminJwt } from './auth.ts';
import { type AuthenticatedUser, verifyAuthenticatedUser } from './orgAuth.ts';
import { verifySuperAdminJwt } from './superAdminAuth.ts';
import {
  handleEdgeError,
  handleOptions,
  jsonError,
  jsonResponse,
  requireHttpMethod,
} from './httpResponse.ts';
import { corsHeaders } from './cors.ts';
import { capturePostHogException } from './posthog.ts';
import { getPlatformSettingsSnapshot } from './platformSettingsCache.ts';
import { checkRateLimit, identityFromRequest, isIdentityBlocked } from './rateLimit.ts';

/**
 * Default per-user authenticated-wrapper limit — production-readiness doc 23
 * Phase 23.2/23.4. Applies to every `serveAdmin` / `serveAuthenticated` call by
 * default rather than per handler — the same "secure by default" posture as the
 * public gate. A handler that already calls `rateLimitGate` explicitly for a
 * specific expensive action is unaffected; this is an additional, separate
 * counter under its own `scope` string so the two never collide or double-count.
 *
 * Enforcement is a super-admin-controlled switch
 * (`platform_settings.authenticated_rate_limit_enforce`, `/admin/platform-settings`),
 * default OFF (log-only `console.warn`). No measured hosted-traffic baseline exists
 * for authenticated request rates (doc 00 tracks Lighthouse/edge-latency, not
 * per-user request counts), so the shipped default of 300/60s is a reasoned,
 * explicitly-unmeasured starting point — 2.5x the original log-only default —
 * biased loose so a bulk-editing host or a multi-tab polled dashboard does not
 * trip it. A super admin can raise the limit or flip back to log-only from the
 * platform settings page instantly, without a deploy, if real traffic disagrees.
 */
const DEFAULT_AUTHENTICATED_WRAPPER_WINDOW_SEC = 60;

async function enforceOrLogRateCheck(
  req: Request,
  logPrefix: string,
  userId: string
): Promise<Response | null> {
  const identity = identityFromRequest(req, { id: userId });

  try {
    if (await isIdentityBlocked(identity)) {
      console.warn(`[rateLimit:blocked] ${logPrefix} — identity ${identity} is on the block list`);
      return jsonError(req, 'Access temporarily restricted. Contact support.', 403);
    }

    const settings = await getPlatformSettingsSnapshot();
    const decision = await checkRateLimit({
      scope: `wrapper-default:${logPrefix}`,
      identity,
      limit: settings.authenticatedRateLimitPerMin,
      windowSec: DEFAULT_AUTHENTICATED_WRAPPER_WINDOW_SEC,
    });
    if (decision.allowed) return null;

    if (!settings.authenticatedRateLimitEnforce) {
      console.warn(
        `[rateLimit:log-only] ${logPrefix} would have been limited — user ${userId}, ` +
          `${decision.count}/${decision.limit} in ${DEFAULT_AUTHENTICATED_WRAPPER_WINDOW_SEC}s`
      );
      return null;
    }

    console.warn(
      `[rateLimit:enforced] ${logPrefix} blocked — user ${userId}, ` +
        `${decision.count}/${decision.limit} in ${DEFAULT_AUTHENTICATED_WRAPPER_WINDOW_SEC}s`
    );
    // Built directly (not via `jsonError`) so `rateLimited` / `retryAfterSec` and
    // the `Retry-After` header survive — `handleEdgeError` would drop them, per
    // `rateLimitGate`'s own doc comment in rateLimit.ts.
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Too many requests. Please wait a moment and try again.',
        retryAfterSec: decision.retryAfterSec,
        rateLimited: true,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders(req),
          'Content-Type': 'application/json',
          'Retry-After': String(decision.retryAfterSec),
        },
      }
    );
  } catch {
    // Must never affect the request on an internal error — already fails open
    // inside `checkRateLimit`/`isIdentityBlocked`, this catch is a final backstop.
    return null;
  }
}

export function serveAdmin(
  logPrefix: string,
  handler: (req: Request, admin: AdminUser) => Promise<Response>
): void {
  serve(async (req) => {
    const options = handleOptions(req);
    if (options) return options;
    try {
      const admin = await verifyAdminJwt(req);
      const limited = await enforceOrLogRateCheck(req, logPrefix, admin.id);
      if (limited) return limited;
      return await handler(req, admin);
    } catch (error) {
      return handleEdgeError(req, error, logPrefix);
    }
  });
}

/** Authenticated user whose email is on SUPER_ADMIN_EMAILS — platform-wide settings only. */
export function serveSuperAdmin(
  logPrefix: string,
  handler: (req: Request, user: AuthenticatedUser) => Promise<Response>
): void {
  serve(async (req) => {
    const options = handleOptions(req);
    if (options) return options;
    try {
      const user = await verifySuperAdminJwt(req);
      return await handler(req, user);
    } catch (error) {
      return handleEdgeError(req, error, logPrefix);
    }
  });
}

/** Any signed-in user (Google OAuth) — used for org/property management. */
export function serveAuthenticated(
  logPrefix: string,
  handler: (req: Request, user: AuthenticatedUser) => Promise<Response>
): void {
  serve(async (req) => {
    const options = handleOptions(req);
    if (options) return options;
    try {
      const user = await verifyAuthenticatedUser(req);
      const limited = await enforceOrLogRateCheck(req, logPrefix, user.id);
      if (limited) return limited;
      return await handler(req, user);
    } catch (error) {
      return handleEdgeError(req, error, logPrefix);
    }
  });
}

export function servePublic(logPrefix: string, handler: (req: Request) => Promise<Response>): void {
  serve(async (req) => {
    const options = handleOptions(req);
    if (options) return options;
    try {
      return await handler(req);
    } catch (error) {
      return handleEdgeError(req, error, logPrefix);
    }
  });
}

export function serveCronPost(
  logPrefix: string,
  verifySecret: (req: Request) => boolean,
  run: () => Promise<Record<string, unknown>>
): void {
  serve(async (req) => {
    const options = handleOptions(req);
    if (options) return options;
    try {
      requireHttpMethod(req, 'POST');
      if (!verifySecret(req)) {
        return jsonError(req, 'Unauthorized', 401);
      }
      const result = await run();
      console.log(`[${logPrefix}]`, JSON.stringify(result));
      return jsonResponse(req, { success: true, ...result });
    } catch (error) {
      console.error(`${logPrefix}:`, error);
      await capturePostHogException(error, { logPrefix: `cron:${logPrefix}`, request: req });
      return jsonError(req, (error as Error).message);
    }
  });
}
