import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { verifyPaymongoWebhookSignature } from './paymongoWebhookVerify.ts';

const TEST_SECRET = 'whsec_paymongo_test_secret';

async function signPaymongoPayload(
  rawBody: string,
  timestamp: string,
  secret: string,
  livemode: boolean
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret.trim()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedPayload = `${timestamp}.${rawBody}`;
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const sigKey = livemode ? 'li' : 'te';
  return `t=${timestamp},${sigKey}=${hex}`;
}

Deno.test('verifyPaymongoWebhookSignature — valid live signature', async () => {
  const rawBody = '{"data":{"id":"evt_test"}}';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const header = await signPaymongoPayload(rawBody, timestamp, TEST_SECRET, true);

  const ok = await verifyPaymongoWebhookSignature(rawBody, header, TEST_SECRET, {
    nowMs: Date.now(),
    livemode: true,
  });
  assert(ok);
});

Deno.test('verifyPaymongoWebhookSignature — rejects tampered body', async () => {
  const rawBody = '{"data":{"id":"evt_test"}}';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const header = await signPaymongoPayload(rawBody, timestamp, TEST_SECRET, true);

  const ok = await verifyPaymongoWebhookSignature(
    '{"data":{"id":"evt_tampered"}}',
    header,
    TEST_SECRET,
    { nowMs: Date.now(), livemode: true }
  );
  assertEquals(ok, false);
});

Deno.test('verifyPaymongoWebhookSignature — rejects stale timestamp', async () => {
  const rawBody = '{"data":{"id":"evt_test"}}';
  const timestamp = String(Math.floor(Date.now() / 1000) - 600);
  const header = await signPaymongoPayload(rawBody, timestamp, TEST_SECRET, true);

  const ok = await verifyPaymongoWebhookSignature(rawBody, header, TEST_SECRET, {
    toleranceSeconds: 300,
    nowMs: Date.now(),
    livemode: true,
  });
  assertEquals(ok, false);
});
