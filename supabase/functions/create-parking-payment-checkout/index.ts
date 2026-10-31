/**
 * create-parking-payment-checkout — guest "Pay now" action while a claimed parking request is
 * PENDING_PAYMENT. Creates (or reuses) a PayMongo Payment Link and returns the checkout URL.
 */

import {
  createParkingPaymentTransaction,
  ParkingPaymentError,
} from '../_shared/parkingPaymentOrchestrator.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('create-parking-payment-checkout', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const bookingId = String(body.bookingId ?? '').trim();

  if (!bookingId) {
    return jsonError(req, 'bookingId is required');
  }

  try {
    const result = await createParkingPaymentTransaction(bookingId, user.id, user.email);
    return jsonSuccess(req, result);
  } catch (err) {
    if (err instanceof ParkingPaymentError) {
      return jsonError(req, err.message, err.status);
    }
    console.error('[create-parking-payment-checkout]', err instanceof Error ? err.message : err);
    return jsonError(req, 'Failed to start payment', 500);
  }
});
