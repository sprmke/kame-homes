import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { verifyMetaWebhookSignatureAsync } from './metaInboxGraph.ts';

const TEST_APP_SECRET = 'meta_test_app_secret_32_chars!!';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function signMetaPayload(rawBody: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  return `sha256=${bytesToHex(new Uint8Array(sig))}`;
}

Deno.test('verifyMetaWebhookSignatureAsync — valid signature', async () => {
  Deno.env.set('META_APP_ID', 'test_app_id');
  Deno.env.set('META_APP_SECRET', TEST_APP_SECRET);

  const rawBody = '{"object":"page","entry":[]}';
  const header = await signMetaPayload(rawBody, TEST_APP_SECRET);

  const ok = await verifyMetaWebhookSignatureAsync(rawBody, header);
  assert(ok);
});

Deno.test('verifyMetaWebhookSignatureAsync — rejects tampered body', async () => {
  Deno.env.set('META_APP_ID', 'test_app_id');
  Deno.env.set('META_APP_SECRET', TEST_APP_SECRET);

  const rawBody = '{"object":"page","entry":[]}';
  const header = await signMetaPayload(rawBody, TEST_APP_SECRET);

  const ok = await verifyMetaWebhookSignatureAsync('{"object":"page","entry":[{}]}', header);
  assertEquals(ok, false);
});

Deno.test('verifyMetaWebhookSignatureAsync — rejects missing header', async () => {
  Deno.env.set('META_APP_ID', 'test_app_id');
  Deno.env.set('META_APP_SECRET', TEST_APP_SECRET);

  const ok = await verifyMetaWebhookSignatureAsync('{}', null);
  assertEquals(ok, false);
});
