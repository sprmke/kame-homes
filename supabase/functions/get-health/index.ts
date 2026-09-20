/**
 * get-health — doc 30 Phase 30.4. Cheap, unauthenticated liveness probe for
 * external uptime monitoring (a monitor hosted on the same platform cannot
 * tell you the platform itself is down).
 *
 * Deliberately minimal: DB reachability + a static version marker. No table
 * names, row counts, migration state, or any other internal detail — those
 * are exactly the kind of thing an unauthenticated endpoint should never leak.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonResponse, requireHttpMethod } from '../_shared/httpResponse.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

/** Bumped manually on a deliberate health-contract change, not per deploy (git SHA already IDs the deploy). */
const HEALTH_CONTRACT_VERSION = 1;

async function checkDatabase(): Promise<boolean> {
  try {
    const sb = createServiceClient();
    // `platform_settings` is a small, always-present singleton-ish table — a
    // `head`+`count` request never returns row data, only confirms the round
    // trip succeeded, so there is nothing here for an unauthenticated caller
    // to read even indirectly.
    const { error } = await sb
      .from('platform_settings')
      .select('id', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}

servePublic('get-health', async (req) => {
  requireHttpMethod(req, 'GET');

  const limited = await publicGetRateLimitGate(req, 'get-health', { maxPerMin: 60 });
  if (limited) return limited;

  const dbOk = await checkDatabase();
  const status = dbOk ? 'ok' : 'degraded';

  return jsonResponse(
    req,
    { success: true, status, version: HEALTH_CONTRACT_VERSION, db: dbOk ? 'ok' : 'unreachable' },
    dbOk ? 200 : 503,
    'private'
  );
});
