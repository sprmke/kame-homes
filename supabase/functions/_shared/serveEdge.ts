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
import { capturePostHogException } from './posthog.ts';
import { checkRateLimit, identityFromRequest } from './rateLimit.ts';

/**
 * Default per-user authenticated-wrapper limit — production-readiness doc 23
 * Phase 23.2. Log-only: never blocks a request, only records when a caller
 * would have exceeded a generous default. Deliberately loose (a bulk-editing
 * host or a multi-tab polled dashboard must not trip this) — this is the
 * observability step before any enforcement decision, per the doc's own
 * "log-only first, then enforce" rollout order. Calibrating a real number
 * needs doc 00's usage baseline (deferred — not measured this session).
 * A handler that already calls `rateLimitGate` explicitly for a specific
 * expensive action is unaffected; this is an additional, separate counter
 * under its own `scope` string so the two never collide or double-count.
 */
const DEFAULT_AUTHENTICATED_LOG_ONLY_LIMIT = 120;
const DEFAULT_AUTHENTICATED_LOG_ONLY_WINDOW_SEC = 60;

async function logOnlyRateCheck(req: Request, logPrefix: string, userId: string): Promise<void> {
  try {
    const decision = await checkRateLimit({
      scope: `wrapper-default:${logPrefix}`,
      identity: identityFromRequest(req, { id: userId }),
      limit: DEFAULT_AUTHENTICATED_LOG_ONLY_LIMIT,
      windowSec: DEFAULT_AUTHENTICATED_LOG_ONLY_WINDOW_SEC,
    });
    if (!decision.allowed) {
      console.warn(
        `[rateLimit:log-only] ${logPrefix} would have been limited — user ${userId}, ` +
          `${decision.count}/${decision.limit} in ${DEFAULT_AUTHENTICATED_LOG_ONLY_WINDOW_SEC}s`
      );
    }
  } catch {
    // Log-only observability must never affect the request — already fails
    // open internally, this catch is a final backstop.
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
      void logOnlyRateCheck(req, logPrefix, admin.id);
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
      void logOnlyRateCheck(req, logPrefix, user.id);
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
