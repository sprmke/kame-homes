/**
 * Svix webhook signature verification for Resend inbound (`email.received`).
 *
 * Signed content: `{svix-id}.{svix-timestamp}.{rawBody}`
 * Secret: `whsec_` + base64 key (Resend dashboard webhook signing secret).
 * Header `svix-signature`: space-separated `v1,<base64sig>` values.
 */

import { webCryptoRawKey } from './webCryptoKey.ts';

const DEFAULT_TOLERANCE_SECONDS = 300;

function decodeWhsec(secret: string): Uint8Array {
  const trimmed = secret.trim();
  const raw = trimmed.startsWith('whsec_') ? trimmed.slice('whsec_'.length) : trimmed;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/**
 * Returns true when the Svix signature is valid and the timestamp is within tolerance.
 */
export async function verifyResendWebhookSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
  options?: { toleranceSeconds?: number; nowMs?: number }
): Promise<boolean> {
  if (!rawBody || !svixId || !svixTimestamp || !svixSignature || !secret) return false;

  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return false;

  const nowMs = options?.nowMs ?? Date.now();
  const tolerance = options?.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(nowMs / 1000 - ts) > tolerance) return false;

  let keyBytes: Uint8Array;
  try {
    keyBytes = decodeWhsec(secret);
  } catch {
    return false;
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    webCryptoRawKey(keyBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
  const expected = new Uint8Array(sig);
  const expectedB64 = bytesToBase64(expected);

  const candidates = svixSignature
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const [, b64] = candidate.split(',');
    if (!b64) continue;
    if (b64 === expectedB64) return true;
    try {
      const got = base64ToBytes(b64);
      if (timingSafeEqual(got, expected)) return true;
    } catch {
      // ignore malformed candidate
    }
  }

  return false;
}
