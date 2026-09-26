/**
 * super-admin-rate-limits — production-readiness doc 23 Phase 23.6 (observability
 * + super-admin visibility). Backs `/admin/rate-limits`.
 *
 * GET: currently-active wrapper-default counters (`request_rate_limits`, scope
 *   `wrapper-default:*`) in the last hour, above a floor, plus the manual block list.
 * POST { action: 'block', identity, reason? } | { action: 'unblock', identity }:
 *   super-admin manual block/unblock, gated behind step-up (`rate_limit_block`).
 *
 * Identity strings are the same `u:<uuid>` / `ip:<addr>` shape `identityFromRequest`
 * produces — this surface does not resolve them to a name; a super admin cross-refs
 * a `u:` id via Organizations/Hosts search if they need to identify the account.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';

const LOOKBACK_MS = 60 * 60_000; // 1 hour — matches the wrapper's 60s window x60
const MIN_COUNT_FLOOR = 1;

function readString(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === 'string' ? (body[key] as string).trim() : '';
}

serveSuperAdmin('super-admin-rate-limits', async (req, user) => {
  const supabase = createServiceClient();

  if (req.method === 'GET') {
    const since = new Date(Date.now() - LOOKBACK_MS).toISOString();

    const [countersRes, blocksRes, settingsRes] = await Promise.all([
      supabase.rpc('list_active_wrapper_rate_limits', {
        p_since: since,
        p_min_count: MIN_COUNT_FLOOR,
      }),
      supabase
        .from('rate_limit_blocks')
        .select('id, identity, reason, blocked_by, blocked_at, expires_at')
        .order('blocked_at', { ascending: false })
        .limit(200),
      supabase
        .from('platform_settings')
        .select('authenticated_rate_limit_enforce, authenticated_rate_limit_per_min')
        .eq('id', 1)
        .maybeSingle(),
    ]);

    if (countersRes.error) return jsonError(req, countersRes.error.message, 500);
    if (blocksRes.error) return jsonError(req, blocksRes.error.message, 500);
    if (settingsRes.error) return jsonError(req, settingsRes.error.message, 500);

    // Collapse per-window rows to one row per (scope, identity) — the caller cares
    // about "who is close to/over the limit right now", not every window edge.
    type Counter = { scope: string; identity: string; window_start: string; count: number };
    const byKey = new Map<string, Counter>();
    for (const row of (countersRes.data ?? []) as Counter[]) {
      const key = `${row.scope}::${row.identity}`;
      const existing = byKey.get(key);
      if (!existing || row.window_start > existing.window_start) byKey.set(key, row);
    }
    const limit = Number(settingsRes.data?.authenticated_rate_limit_per_min ?? 300);
    const activeCounters = Array.from(byKey.values())
      .map((row) => ({
        scope: row.scope.replace(/^wrapper-default:/, ''),
        identity: row.identity,
        windowStart: row.window_start,
        count: row.count,
        limit,
        overLimit: row.count > limit,
      }))
      .sort((a, b) => b.count - a.count);

    return jsonSuccess(req, {
      enforceEnabled: settingsRes.data?.authenticated_rate_limit_enforce === true,
      limit,
      activeCounters,
      blocks: (blocksRes.data ?? []).map((b) => ({
        id: b.id as string,
        identity: b.identity as string,
        reason: (b.reason as string | null) ?? null,
        blockedBy: (b.blocked_by as string | null) ?? null,
        blockedAt: b.blocked_at as string,
        expiresAt: (b.expires_at as string | null) ?? null,
      })),
    });
  }

  if (req.method === 'POST') {
    const stepUp = await requireSuperAdminStepUp(req, user, 'rate_limit_block');
    if (stepUp) return stepUp;

    const body = await readJsonBody(req);
    const action = readString(body, 'action');
    const identity = readString(body, 'identity');

    if (!identity || !/^(u:[a-zA-Z0-9-]+|ip:.+)$/.test(identity)) {
      return jsonError(req, 'identity must look like u:<userId> or ip:<address>', 400);
    }

    if (action === 'block') {
      const reason = readString(body, 'reason') || null;
      const { error } = await supabase
        .from('rate_limit_blocks')
        .upsert(
          { identity, reason, blocked_by: user.id, blocked_at: new Date().toISOString() },
          { onConflict: 'identity' }
        );
      if (error) return jsonError(req, error.message, 500);

      await logSuperAdminAction(user, {
        action: 'rate_limit.block',
        targetType: 'rate_limit_identity',
        targetId: identity,
        summary: `Blocked ${identity}${reason ? `: ${reason}` : ''}`,
        metadata: { identity, reason },
      });
      return jsonSuccess(req, { blocked: identity });
    }

    if (action === 'unblock') {
      const { error } = await supabase.from('rate_limit_blocks').delete().eq('identity', identity);
      if (error) return jsonError(req, error.message, 500);

      await logSuperAdminAction(user, {
        action: 'rate_limit.unblock',
        targetType: 'rate_limit_identity',
        targetId: identity,
        summary: `Unblocked ${identity}`,
        metadata: { identity },
      });
      return jsonSuccess(req, { unblocked: identity });
    }

    return jsonError(req, "action must be 'block' or 'unblock'", 400);
  }

  return jsonError(req, 'Method not allowed', 405);
});
