/**
 * paymongo-webhook — Verify signature, dedupe, delegate to subscriptionOrchestrator.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { verifyPaymongoWebhookSignature } from '../_shared/paymongoWebhookVerify.ts';
import {
  handlePaymongoWebhookEvent,
  paymongoLivemodeFromEnv,
} from '../_shared/subscriptionOrchestrator.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

servePublic('paymongo-webhook', async (req) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const secret = Deno.env.get('PAYMONGO_WEBHOOK_SECRET')?.trim();
  if (!secret) {
    console.error('[paymongo-webhook] PAYMONGO_WEBHOOK_SECRET not configured');
    return jsonError(req, 'Webhook not configured', 503);
  }

  const rawBody = await req.text();
  const signature = req.headers.get('Paymongo-Signature') ?? req.headers.get('paymongo-signature');
  if (!signature) return jsonError(req, 'Missing signature', 400);

  const valid = await verifyPaymongoWebhookSignature(rawBody, signature, secret, {
    livemode: paymongoLivemodeFromEnv(),
  });
  if (!valid) {
    const limited = await rateLimitGate(req, {
      scope: 'paymongo-webhook-bad-signature',
      identity: identityFromRequest(req),
      limit: 30,
      windowSec: 60,
    });
    if (limited) return limited;
    return jsonError(req, 'Invalid signature', 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonError(req, 'Invalid JSON', 400);
  }

  const data = payload.data as Record<string, unknown> | undefined;
  const attributes = data?.attributes as Record<string, unknown> | undefined;
  const eventId = typeof data?.id === 'string' ? data.id : null;
  const eventType = typeof attributes?.type === 'string' ? attributes.type : null;

  if (!eventId || !eventType) {
    return jsonError(req, 'Malformed webhook payload', 400);
  }

  const supabase = createServiceClient();
  const { error: dedupeError } = await supabase.from('processed_paymongo_events').insert({
    event_id: eventId,
    event_type: eventType,
  });
  if (dedupeError) {
    if (dedupeError.code === '23505') {
      return jsonSuccess(req, { duplicate: true });
    }
    return jsonError(req, dedupeError.message, 500);
  }

  try {
    const result = await handlePaymongoWebhookEvent(eventType, payload);
    return jsonSuccess(req, { eventType, ...result });
  } catch (err) {
    console.error('[paymongo-webhook]', err);
    return jsonError(req, (err as Error).message, 500);
  }
});
