import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  assertPublicHttpUrl,
  isPrivateIpLiteral,
  UnsafeOutboundUrlError,
} from './safeOutboundUrl.ts';

Deno.test('isPrivateIpLiteral covers loopback, RFC1918, link-local, CGNAT', () => {
  assertEquals(isPrivateIpLiteral('127.0.0.1'), true);
  assertEquals(isPrivateIpLiteral('10.0.0.1'), true);
  assertEquals(isPrivateIpLiteral('192.168.1.1'), true);
  assertEquals(isPrivateIpLiteral('172.16.0.1'), true);
  assertEquals(isPrivateIpLiteral('169.254.169.254'), true);
  assertEquals(isPrivateIpLiteral('100.64.0.1'), true);
  assertEquals(isPrivateIpLiteral('::1'), true);
  assertEquals(isPrivateIpLiteral('8.8.8.8'), false);
  assertEquals(isPrivateIpLiteral('1.1.1.1'), false);
});

Deno.test('assertPublicHttpUrl rejects private, localhost, credentials, non-http', async () => {
  await assertRejects(() => assertPublicHttpUrl('https://127.0.0.1/x'), UnsafeOutboundUrlError);
  await assertRejects(
    () => assertPublicHttpUrl('https://169.254.169.254/latest/meta-data'),
    UnsafeOutboundUrlError
  );
  await assertRejects(() => assertPublicHttpUrl('https://localhost/x'), UnsafeOutboundUrlError);
  await assertRejects(
    () => assertPublicHttpUrl('https://user:pass@example.com/x'),
    UnsafeOutboundUrlError
  );
  await assertRejects(() => assertPublicHttpUrl('file:///etc/passwd'), UnsafeOutboundUrlError);
  const https = await assertPublicHttpUrl('https://example.com/audio.mp3');
  assertEquals(https.hostname, 'example.com');
});

Deno.test('assertPublicHttpUrl httpsOnly rejects http', async () => {
  await assertRejects(
    () => assertPublicHttpUrl('http://example.com/x', { httpsOnly: true }),
    UnsafeOutboundUrlError
  );
});
