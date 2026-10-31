/**
 * PayMongo webhook HMAC-SHA256 verification.
 * Header: Paymongo-Signature: t=<ts>,te=<test_sig>,li=<live_sig>
 * Signed payload: `${t}.${rawBody}`
 */

const DEFAULT_TOLERANCE_SECONDS = 300;

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim();
  if (normalized.length % 2 !== 0) throw new Error('invalid hex');
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function parseSignatureHeader(header: string): {
  timestamp: string;
  testSig: string | null;
  liveSig: string | null;
} | null {
  const parts = header.split(',').map((p) => p.trim());
  let timestamp = '';
  let testSig: string | null = null;
  let liveSig: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    if (key === 't') timestamp = value;
    if (key === 'te') testSig = value;
    if (key === 'li') liveSig = value;
  }

  if (!timestamp) return null;
  return { timestamp, testSig, liveSig };
}

export async function verifyPaymongoWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  options?: { toleranceSeconds?: number; nowMs?: number; livemode?: boolean }
): Promise<boolean> {
  if (!rawBody || !signatureHeader || !secret) return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const ts = Number(parsed.timestamp);
  if (!Number.isFinite(ts)) return false;

  const tolerance = options?.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowMs = options?.nowMs ?? Date.now();
  if (Math.abs(nowMs / 1000 - ts) > tolerance) return false;

  const expectedSig = options?.livemode === false ? parsed.testSig : parsed.liveSig;
  const fallbackSig = expectedSig ?? parsed.testSig ?? parsed.liveSig;
  if (!fallbackSig) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret.trim()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
  const expected = new Uint8Array(sig);

  try {
    const got = hexToBytes(fallbackSig);
    return timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}
