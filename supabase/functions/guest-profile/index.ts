/**
 * guest-profile — GET/PATCH signed-in guest profile.
 */

import { getGuestProfile, patchGuestProfile } from '../_shared/guestProfileService.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('guest-profile', async (req, user) => {
  if (req.method === 'GET') {
    const profile = await getGuestProfile(user);
    return jsonSuccess(req, profile);
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const patch: Record<string, unknown> = {};

    if (typeof body.displayName === 'string') patch.displayName = body.displayName;
    if (body.bio === null || typeof body.bio === 'string') patch.bio = body.bio;
    if (body.avatarUrl === null || typeof body.avatarUrl === 'string') {
      patch.avatarUrl = body.avatarUrl;
    }
    if (body.phone === null || typeof body.phone === 'string') patch.phone = body.phone;
    if (body.locationLabel === null || typeof body.locationLabel === 'string') {
      patch.locationLabel = body.locationLabel;
    }

    if (Object.keys(patch).length === 0) {
      return jsonError(req, 'No valid fields to update', 400);
    }

    try {
      const profile = await patchGuestProfile(user, patch);
      return jsonSuccess(req, profile);
    } catch (e) {
      return jsonError(req, (e as Error).message, 400);
    }
  }

  return jsonError(req, 'Method not allowed', 405);
});
