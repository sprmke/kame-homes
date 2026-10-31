/**
 * list-linkable-property-bookings — Phase 7 self-serve entry point. Returns this signed-in
 * guest's confirmed property stays that still need a marketplace parking booking linked, so
 * the parking registration flow can offer "which stay is this for?" instead of a blind form.
 */

import { listLinkableParkingBookingsForGuest } from '../_shared/parkingPropertyLink.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('list-linkable-property-bookings', async (req, user) => {
  requireHttpMethod(req, 'GET');

  try {
    const bookings = await listLinkableParkingBookingsForGuest(user.id, user.email);
    return jsonSuccess(req, { bookings });
  } catch (err) {
    console.error('[list-linkable-property-bookings]', err instanceof Error ? err.message : err);
    return jsonError(req, 'Failed to load bookings', 500);
  }
});
