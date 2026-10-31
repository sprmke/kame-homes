/**
 * get-feature-availability — authenticated GET consumed by every host dashboard tab via
 * `ui/src/lib/featureAvailability/useFeatureAvailability.ts`. Returns only the catalog
 * keys that are currently off (plus `serverNow`, to avoid client clock skew on
 * expected-back copy) — an available key is simply absent from `entries`, and the
 * client hook defaults `available: true` for anything not in the list.
 *
 * `Cache-Control: private, no-store` (same reasoning as `get-public-platform-status`):
 * this must never be cached by a shared cache or served stale from the PWA SW
 * (NetworkOnly rule in `ui/vite.config.ts`, see plan task 2.6).
 */

import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { jsonSuccess } from '../_shared/httpResponse.ts';
import { getFeatureAvailabilityRows } from '../_shared/featureAvailability.ts';
import { buildFeatureAvailabilityEntries } from '../_shared/featureAvailabilityPublicEntries.ts';

serveAuthenticated('get-feature-availability', async (req, user) => {
  const now = new Date();
  const rows = await getFeatureAvailabilityRows();
  const entries = buildFeatureAvailabilityEntries(rows, now, user);
  return jsonSuccess(req, { serverNow: now.toISOString(), entries });
});
