import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { verifyResendWebhookSignature } from './resendWebhookVerify.ts';

const TEST_SECRET = 'whsec_' + btoa('test-signing-key-32-bytes-long!!');

async function signPayload(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  secret: string
): Promise<string> {
  const raw = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const binary = atob(raw);
  const keyBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) keyBytes[i] = binary.charCodeAt(i);

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  let binarySig = '';
  for (const byte of new Uint8Array(sig)) binarySig += String.fromCharCode(byte);
  return `v1,${btoa(binarySig)}`;
}

Deno.test('verifyResendWebhookSignature — valid signature', async () => {
  const rawBody = '{"type":"email.received"}';
  const svixId = 'msg_test_001';
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signPayload(rawBody, svixId, svixTimestamp, TEST_SECRET);

  const ok = await verifyResendWebhookSignature(
    rawBody,
    svixId,
    svixTimestamp,
    signature,
    TEST_SECRET,
    { nowMs: Date.now() }
  );
  assert(ok);
});

Deno.test('verifyResendWebhookSignature — rejects tampered body', async () => {
  const rawBody = '{"type":"email.received"}';
  const svixId = 'msg_test_002';
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signPayload(rawBody, svixId, svixTimestamp, TEST_SECRET);

  const ok = await verifyResendWebhookSignature(
    '{"type":"email.received","extra":true}',
    svixId,
    svixTimestamp,
    signature,
    TEST_SECRET,
    { nowMs: Date.now() }
  );
  assertEquals(ok, false);
});

Deno.test('verifyResendWebhookSignature — rejects stale timestamp', async () => {
  const rawBody = '{"type":"email.received"}';
  const svixId = 'msg_test_003';
  const svixTimestamp = String(Math.floor(Date.now() / 1000) - 600);
  const signature = await signPayload(rawBody, svixId, svixTimestamp, TEST_SECRET);

  const ok = await verifyResendWebhookSignature(
    rawBody,
    svixId,
    svixTimestamp,
    signature,
    TEST_SECRET,
    { toleranceSeconds: 300, nowMs: Date.now() }
  );
  assertEquals(ok, false);
});
