/**
 * HMAC capability tokens for the identity-capture handoff.
 *
 * Format: `v1.{sessionId}.{expMs}.{nonce}.{sig}` — base64url signature.
 *
 * Deliberately tighter than `guestBookingAccessToken.ts`:
 *   * 10-minute TTL (not 180 days).
 *   * Purpose-bound: the payload carries exactly one session id, and the session row is the
 *     only thing it can reach.
 *   * Revocable: the session status is checked on every use, so `completed` / `failed` /
 *     `expired` rejects the token immediately even though the signature is still valid.
 *   * `token_hash` is stored, never the token. The raw value exists only in the URL.
 *
 * NOT consumed on read. iOS Safari reloads a backgrounded tab; burning the token on the
 * first GET would strand a guest mid-capture with an unusable link. Single-use is enforced
 * at the session level (one submit) instead.
 */

const TOKEN_VERSION = 'v1';
export const IDENTITY_SESSION_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const explicit = Deno.env.get('IDENTITY_SESSION_SECRET')?.trim();
  if (explicit) return explicit;
  throw new Error('IDENTITY_SESSION_SECRET is required');
}

function toBase64Url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

/** Constant-time string compare — length check first, then XOR accumulate. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashIdentitySessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token.trim()));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function randomNonce(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export type MintedIdentitySessionToken = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

export async function mintIdentitySessionToken(
  sessionId: string,
  ttlMs = IDENTITY_SESSION_TTL_MS
): Promise<MintedIdentitySessionToken> {
  const id = sessionId.trim();
  if (!id) throw new Error('sessionId required');
  const expiresAt = new Date(Date.now() + ttlMs);
  const payload = `${TOKEN_VERSION}.${id}.${expiresAt.getTime()}.${randomNonce()}`;
  const signature = await hmacSign(payload);
  const token = `${payload}.${signature}`;
  return { token, tokenHash: await hashIdentitySessionToken(token), expiresAt };
}

export type IdentitySessionTokenResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: 'missing' | 'malformed' | 'expired' | 'invalid' };

export async function verifyIdentitySessionToken(
  token: string | null | undefined
): Promise<IdentitySessionTokenResult> {
  const trimmed = (token ?? '').trim();
  if (!trimmed) return { ok: false, reason: 'missing' };

  const parts = trimmed.split('.');
  if (parts.length !== 5 || parts[0] !== TOKEN_VERSION) return { ok: false, reason: 'malformed' };

  const sessionId = parts[1] ?? '';
  const expiresMs = Number(parts[2]);
  const nonce = parts[3] ?? '';
  const signature = parts[4] ?? '';
  if (!sessionId || !nonce || !signature || !Number.isFinite(expiresMs)) {
    return { ok: false, reason: 'malformed' };
  }
  if (Date.now() > expiresMs) return { ok: false, reason: 'expired' };

  const expected = await hmacSign(`${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}`);
  if (!timingSafeEqual(expected, signature)) return { ok: false, reason: 'invalid' };

  return { ok: true, sessionId };
}

/** Token from `?t=`, an `x-identity-session` header, or a multipart body field. */
export function identitySessionTokenFromRequest(
  req: Request,
  body?: FormData | Record<string, unknown> | null
): string | null {
  const header = req.headers.get('x-identity-session')?.trim();
  if (header) return header;
  const fromQuery = new URL(req.url).searchParams.get('t')?.trim();
  if (fromQuery) return fromQuery;
  if (body instanceof FormData) {
    const value = (body.get('t')?.toString() ?? '').trim();
    return value || null;
  }
  if (body && typeof body === 'object') {
    const raw = body.t;
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
}
