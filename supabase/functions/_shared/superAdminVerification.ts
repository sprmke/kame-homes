/**
 * Step-up (second-factor) verification for sensitive Super Admin actions.
 *
 * Model: "sudo window". A super admin verifies a one-time code emailed to their own
 * login address; `verify_otp` then returns a short-lived signed token that unlocks every
 * gated `serveSuperAdmin` mutation for `SUDO_TOKEN_TTL_MS`. Mirrors the host payment-
 * settings flow in `settingsVerification.ts` but platform-scoped (no org/property).
 */

import type { SupabaseClient } from './supabaseJs.ts';
import { webCryptoRawKey } from './webCryptoKey.ts';

import { jsonResponse } from './httpResponse.ts';
import type { AuthenticatedUser } from './orgAuth.ts';
import { generateOtpCode, hashOtpCode } from './settingsVerification.ts';

export const SUPER_ADMIN_STEP_UP_ACTION = 'super_admin_step_up' as const;

const OTP_TTL_MS = 10 * 60 * 1000;
const SUDO_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_OTP_SENDS_PER_WINDOW = 3;
const SEND_RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

/** Envelope code the client watches for to open the step-up dialog. */
export const SUPER_ADMIN_OTP_REQUIRED_CODE = 'SUPERADMIN_OTP_REQUIRED' as const;

/** Request header carrying the sudo token. Must be allow-listed in `cors.ts`. */
export const SUPER_ADMIN_OTP_HEADER = 'x-superadmin-otp';

/**
 * Human labels for each gated action — surfaced in the dialog + OTP email so the admin
 * knows what they are about to authorize. Add a row here to gate a new action.
 */
export const GATED_SUPER_ADMIN_ACTIONS: Record<string, string> = {
  org_subscription: 'change an organization subscription or billing period',
  platform_payment_settings: "change the platform's payment rails",
  platform_parking_settings: "change the parking vertical's commission and rate settings",
  parking_payout: 'record a parking payout or clawback',
  ai_credit_wallet: "adjust an organization's AI credit wallet",
  ai_global_settings: 'change platform-wide AI settings',
  dashboard_assistant_global_settings: 'change the dashboard assistant kill switch',
  pricing_plans: 'change the subscription plan catalog',
  platform_settings: 'change platform-wide settings',
  platform_host_settings: 'change platform host announcements',
  contract_consideration: 'decide a listing contract consideration',
  ai_generation_overrides: 'change per-property AI media generation caps or premium models',
  rate_limit_block: 'block or unblock an identity from the platform',
};

export function superAdminActionLabel(action: string | null | undefined): string {
  return (action && GATED_SUPER_ADMIN_ACTIONS[action]) || 'perform a sensitive super-admin action';
}

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const maskedLocal =
    local.length <= 1 ? '*' : `${local[0]}${'*'.repeat(Math.min(3, local.length - 1))}`;
  return `${maskedLocal}@${domain}`;
}

/* ----------------------------- sudo token (HMAC) ---------------------------- */

function hmacSecret(): Uint8Array {
  const raw =
    Deno.env.get('SUPER_ADMIN_VERIFICATION_SECRET')?.trim() ||
    Deno.env.get('SETTINGS_VERIFICATION_SECRET')?.trim() ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    'local-dev-super-admin-verification';
  return new TextEncoder().encode(raw);
}

async function importHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    webCryptoRawKey(hmacSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

type SudoTokenPayload = { userId: string; exp: number };

export async function signSudoToken(userId: string): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + SUDO_TOKEN_TTL_MS;
  const payload: SudoTokenPayload = { userId, exp: expiresAt };
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return { token: `${body}.${base64UrlEncode(new Uint8Array(sig))}`, expiresAt };
}

export async function verifySudoToken(token: string): Promise<SudoTokenPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sigPart] = parts;
  if (!body || !sigPart) return null;

  const key = await importHmacKey();
  const expected = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const actual = base64UrlDecode(sigPart);
  if (actual.length !== expected.byteLength) return null;
  const a = new Uint8Array(expected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ actual[i]!;
  if (diff !== 0) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SudoTokenPayload;
    if (!parsed.userId || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ------------------------------ OTP challenges ----------------------------- */

export async function assertStepUpRateLimit(
  supabase: SupabaseClient,
  requestedBy: string
): Promise<void> {
  const since = new Date(Date.now() - SEND_RATE_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from('super_admin_verification_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('requested_by', requestedBy)
    .gte('created_at', since);
  if (error) {
    console.error('[superAdminVerification] rate limit check failed', error.message);
    throw new Error('Could not send verification code');
  }
  if ((count ?? 0) >= MAX_OTP_SENDS_PER_WINDOW) {
    throw new Error('Too many verification codes sent. Try again in a few minutes.');
  }
}

async function invalidateOpenChallenges(
  supabase: SupabaseClient,
  requestedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('super_admin_verification_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('requested_by', requestedBy)
    .is('consumed_at', null);
  if (error) {
    console.warn('[superAdminVerification] invalidateOpenChallenges:', error.message);
  }
}

export async function createStepUpChallenge(
  supabase: SupabaseClient,
  input: { userId: string; email: string }
): Promise<{ challengeId: string; code: string; expiresAt: string }> {
  await invalidateOpenChallenges(supabase, input.userId);
  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from('super_admin_verification_challenges')
    .insert({
      requested_by: input.userId,
      requested_email: input.email,
      action: SUPER_ADMIN_STEP_UP_ACTION,
      code_hash: codeHash,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    console.error('[superAdminVerification] create challenge failed', error?.message);
    throw new Error('Could not create verification challenge');
  }

  return { challengeId: data.id as string, code, expiresAt };
}

export async function verifyStepUpChallenge(
  supabase: SupabaseClient,
  input: { challengeId: string; code: string; userId: string }
): Promise<void> {
  const { data: row, error } = await supabase
    .from('super_admin_verification_challenges')
    .select('*')
    .eq('id', input.challengeId)
    .maybeSingle();

  if (error || !row) {
    throw new Error('Invalid or expired verification code');
  }
  if (row.requested_by !== input.userId) {
    throw new Error('Verification code was issued to a different account');
  }
  if (row.consumed_at) {
    throw new Error('Verification code already used');
  }
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    throw new Error('Verification code expired');
  }
  if ((row.failed_attempts as number) >= MAX_FAILED_ATTEMPTS) {
    throw new Error('Too many failed attempts. Request a new code.');
  }

  const actualHash = await hashOtpCode(input.code);
  if ((row.code_hash as string) !== actualHash) {
    await supabase
      .from('super_admin_verification_challenges')
      .update({ failed_attempts: (row.failed_attempts as number) + 1 })
      .eq('id', input.challengeId);
    throw new Error('Invalid verification code');
  }

  const { error: consumeError } = await supabase
    .from('super_admin_verification_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', input.challengeId)
    .is('consumed_at', null);
  if (consumeError) {
    throw new Error('Verification code already used');
  }
}

/* --------------------------------- guard --------------------------------- */

/**
 * Call at the top of every mutating branch of a gated `serveSuperAdmin` function.
 * Returns a `Response` (401 with `SUPERADMIN_OTP_REQUIRED`) when the caller must step up,
 * or `null` when a valid sudo token is present — `if (res) return res;`.
 * GET / OPTIONS always pass.
 */
export async function requireSuperAdminStepUp(
  req: Request,
  user: Pick<AuthenticatedUser, 'id'>,
  action: keyof typeof GATED_SUPER_ADMIN_ACTIONS
): Promise<Response | null> {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return null;
  }

  const token = req.headers.get(SUPER_ADMIN_OTP_HEADER)?.trim() ?? '';
  if (token) {
    const payload = await verifySudoToken(token);
    if (payload && payload.userId === user.id) return null;
  }

  return jsonResponse(
    req,
    {
      success: false,
      error: `Extra verification required to ${superAdminActionLabel(
        action
      )}. Enter the code sent to your email.`,
      code: SUPER_ADMIN_OTP_REQUIRED_CODE,
      action,
    },
    401
  );
}

export { OTP_TTL_MS, SUDO_TOKEN_TTL_MS, MAX_FAILED_ATTEMPTS };
