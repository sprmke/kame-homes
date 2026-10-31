/**
 * guest-messages — List web chat threads for the signed-in guest.
 */

import { listGuestMessageThreads } from '../_shared/guestProfileService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('guest-messages', async (req, user) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const threads = await listGuestMessageThreads(user);
  return jsonSuccess(req, { threads });
});
