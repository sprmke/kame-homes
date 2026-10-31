/**
 * get-public-platform-status — anon-safe read of maintenance + signups flags.
 * No secrets; rate-limited public GET.
 */

import { getPlatformSettingsSnapshot } from '../_shared/platformSettingsCache.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

servePublic('get-public-platform-status', async (req) => {
  requireHttpMethod(req, 'GET');

  const limited = await publicGetRateLimitGate(req, 'get-public-platform-status', {
    maxPerMin: 30,
  });
  if (limited) return limited;

  const settings = await getPlatformSettingsSnapshot();
  // Deliberately NOT a public* cache class (doc 11 edge case): maintenanceMode
  // must never be served from a longer-lived cache than the existing 60s
  // in-memory `platformSettingsCache` path, or users stay in maintenance after
  // it's lifted. `private` here just means "don't let a shared/browser cache
  // hold this" — the response itself is not sensitive.
  return jsonSuccess(req, {
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    signupsEnabled: settings.signupsEnabled,
  });
});
