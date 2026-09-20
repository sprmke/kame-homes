/**
 * HMAC guest booking access tokens — optional gate for PII reads (get-form, get-sd-form, …).
 *
 * Staged rollout: mint on new bookings; endpoints accept legacy bare bookingId until
 * GUEST_BOOKING_ACCESS_ENFORCE=true in edge secrets.
 *
 * Capability-token audit (production-readiness doc 21.3, 2026-09-18):
 * - TTL: 180 days (`DEFAULT_TTL_MS`). Not shortened this pass (product decision).
 * - Purpose: payload is `v1.{bookingId}.{exp}.{sig}` — binds the booking only,
 *   not a single endpoint/purpose. Any holder of a valid token can hit every
 *   guest-PII reader that accepts `?access=` for that booking.
 * - Revocation: none. Cancelling a booking does not denylist the token; the
 *   handler must still 404/410 from booking status. There is no denylist table.
 * - Telemetry: PostHog property keys `access`/`token` are dropped
 *   (`posthogSanitize.ts`); edge `handleEdgeError` redacts every query-param
 *   value before forwarding `req.url`.
 */

const TOKEN_VERSION = 'v1';
const DEFAULT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function secret(): string {
  const explicit = Deno.env.get('GUEST_BOOKING_ACCESS_SECRET')?.trim();
  if (explicit) return explicit;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (service) return service;
  throw new Error('GUEST_BOOKING_ACCESS_SECRET or SUPABASE_SERVICE_ROLE_KEY required');
}

function toBase64Url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? padded : padded + '='.repeat(4 - (padded.length % 4));
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

async function hmacVerify(payload: string, signatureB64Url: string): Promise<boolean> {
  const expected = await hmacSign(payload);
  if (expected.length !== signatureB64Url.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureB64Url.charCodeAt(i);
  }
  return diff === 0;
}

/** Mint a time-limited access token for a booking row. */
export async function mintGuestBookingAccessToken(
  bookingId: string,
  ttlMs = DEFAULT_TTL_MS
): Promise<string> {
  const id = bookingId.trim();
  if (!id) throw new Error('bookingId required');
  const exp = Date.now() + ttlMs;
  const payload = `${TOKEN_VERSION}.${id}.${exp}`;
  const sig = await hmacSign(payload);
  return `${payload}.${sig}`;
}

export type GuestBookingAccessVerifyResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: 'missing' | 'malformed' | 'expired' | 'invalid' };

/** Parse and verify a token without trusting the URL booking id. */
export async function verifyGuestBookingAccessToken(
  token: string
): Promise<GuestBookingAccessVerifyResult> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, reason: 'missing' };

  const parts = trimmed.split('.');
  // v1.{bookingId}.{expMs}.{sig} — bookingId is a UUID (hyphens, no dots).
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
    return { ok: false, reason: 'malformed' };
  }

  const bookingId = parts[1] ?? '';
  const exp = Number(parts[2]);
  const sig = parts[3] ?? '';
  if (!bookingId || !Number.isFinite(exp) || !sig) {
    return { ok: false, reason: 'malformed' };
  }
  if (Date.now() > exp) return { ok: false, reason: 'expired' };

  const payload = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const valid = await hmacVerify(payload, sig);
  if (!valid) return { ok: false, reason: 'invalid' };

  return { ok: true, bookingId };
}

/** When true, PII endpoints reject requests without a valid access token. */
export function guestBookingAccessEnforced(): boolean {
  return Deno.env.get('GUEST_BOOKING_ACCESS_ENFORCE')?.trim().toLowerCase() === 'true';
}

/** Legacy bare-UUID grace after booking creation (default 30 days). Set 0 to disable. */
export function guestBookingAccessLegacyGraceDays(): number {
  const raw = Deno.env.get('GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS')?.trim();
  if (!raw) return 30;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 30;
}

export function isWithinGuestBookingLegacyGrace(createdAt: string | null | undefined): boolean {
  const days = guestBookingAccessLegacyGraceDays();
  if (days === 0 || !createdAt?.trim()) return false;
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= days * 24 * 60 * 60 * 1000;
}

/** Token from `?access=` or a write body / FormData `access` field. */
export function guestBookingAccessTokenFromRequest(
  req: Request,
  body?: FormData | Record<string, unknown> | null
): string | null {
  const fromQuery = new URL(req.url).searchParams.get('access')?.trim();
  if (fromQuery) return fromQuery;
  if (body instanceof FormData) {
    const value = (body.get('access')?.toString() ?? '').trim();
    return value || null;
  }
  if (body && typeof body === 'object') {
    const raw = body.access;
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
}

/**
 * Authorize a booking-scoped public read or write.
 * Legacy: bookingId path alone when enforcement is off.
 * Staged: optional `access` query/body must match bookingId when provided.
 * Enforced: valid access token required.
 */
export async function authorizeGuestBookingAccess(input: {
  bookingIdFromPath: string;
  accessTokenFromQuery: string | null;
  /** When enforcement is on, bare UUID still works inside the legacy grace window. */
  bookingCreatedAt?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const bookingId = input.bookingIdFromPath.trim();
  const access = input.accessTokenFromQuery?.trim() ?? '';

  if (guestBookingAccessEnforced()) {
    if (!access) {
      if (isWithinGuestBookingLegacyGrace(input.bookingCreatedAt)) {
        return { ok: true };
      }
      return { ok: false, status: 401, message: 'Access token required' };
    }
    const verified = await verifyGuestBookingAccessToken(access);
    if (!verified.ok || verified.bookingId !== bookingId) {
      return { ok: false, status: 401, message: 'Invalid or expired access link' };
    }
    return { ok: true };
  }

  if (access) {
    const verified = await verifyGuestBookingAccessToken(access);
    if (!verified.ok || verified.bookingId !== bookingId) {
      return { ok: false, status: 401, message: 'Invalid or expired access link' };
    }
  }

  return { ok: true };
}
