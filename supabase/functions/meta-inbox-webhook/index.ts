/**
 * Meta webhook receiver — GET verify, POST messaging + read receipts.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { runAfterResponse } from '../_shared/backgroundTask.ts';
import { maybeAutoReplyToInboundDm } from '../_shared/metaInboxAutoReply.ts';
import { metaWebhookVerifyToken } from '../_shared/metaInboxConfig.ts';
import {
  handleMetaMessagingWebhook,
  handleMetaReadReceipt,
} from '../_shared/metaInboxWebhookHandler.ts';
import { verifyMetaWebhookSignatureAsync } from '../_shared/metaInboxGraph.ts';
import { handleEdgeError, jsonError } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { buildDmThreadId, getConnectionForMetaWebhook } from '../_shared/socialInboxService.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === metaWebhookVerifyToken() && challenge) {
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      return new Response('Forbidden', { status: 403 });
    }

    if (req.method !== 'POST') {
      return jsonError(req, 'Method not allowed', 405);
    }

    const rawBody = await req.text();
    const signature = req.headers.get('X-Hub-Signature-256');
    const valid = await verifyMetaWebhookSignatureAsync(rawBody, signature);
    if (!valid) {
      const limited = await rateLimitGate(req, {
        scope: 'meta-inbox-webhook-bad-signature',
        identity: identityFromRequest(req),
        limit: 30,
        windowSec: 60,
      });
      if (limited) return limited;
      return jsonError(req, 'Invalid signature', 403);
    }

    let payload: {
      object?: string;
      entry?: Array<{
        id: string;
        messaging?: unknown[];
        changes?: unknown[];
      }>;
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonError(req, 'Invalid JSON', 400);
    }

    for (const entry of payload.entry ?? []) {
      const pageOrIgId = entry.id;

      for (const messaging of (entry.messaging ?? []) as Record<string, unknown>[]) {
        const recipientId = (messaging.recipient as { id?: string })?.id;
        const platform =
          payload.object === 'instagram' || recipientId?.startsWith('17')
            ? ('instagram' as const)
            : ('facebook' as const);

        if (messaging.read) {
          const senderId = (messaging.sender as { id?: string })?.id ?? '';
          await handleMetaReadReceipt(pageOrIgId, senderId, platform);
          continue;
        }

        if (messaging.message) {
          await handleMetaMessagingWebhook(pageOrIgId, messaging as never, platform);
          const guestId = (messaging.sender as { id?: string })?.id;
          if (guestId && !(messaging.message as { is_echo?: boolean }).is_echo) {
            const conn = await getConnectionForMetaWebhook(pageOrIgId, platform);
            const inboundMid = (messaging.message as { mid?: string }).mid;
            if (conn && inboundMid) {
              // After the 200 — Meta expects a fast ack; the AI call must not hold it open.
              await runAfterResponse('meta-inbox-webhook auto-reply', () =>
                maybeAutoReplyToInboundDm(
                  conn.organization_id,
                  buildDmThreadId(platform, guestId),
                  platform,
                  inboundMid
                )
              );
            }
          }
        }
      }

      void entry.changes;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return await handleEdgeError(req, error, '[meta-inbox-webhook]');
  }
});
