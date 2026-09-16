/**
 * Sensitive settings verification — OTP challenges + signed verification tokens.
 * Keep payment fingerprint logic in sync with `ui/src/features/dashboard/org/lib/settingsVerificationFingerprint.ts`.
 */

import type { SupabaseClient } from './supabaseJs.ts';
import { webCryptoRawKey } from './webCryptoKey.ts';

import { formatPaymentAccountNumberDisplay, normalizePaymentProvider } from './paymentProviders.ts';
import type { PropertyPaymentMethod } from './paymentMethods.ts';

export const SETTINGS_VERIFICATION_ACTION = 'payment_settings' as const;

export type SettingsVerificationAction = typeof SETTINGS_VERIFICATION_ACTION;

export const SENSITIVE_SETTINGS_ACTIONS = {
  [SETTINGS_VERIFICATION_ACTION]: {
    label: 'Payment settings',
    propertyPatchKeys: [
      'paymentMethods',
      'paymentProvider',
      'gcashName',
      'gcashNumber',
      'gcashQrImageUrl',
    ] as const,
    parkingPatchKeys: [
      'paymentMethods',
      'paymentProvider',
      'gcashName',
      'gcashNumber',
      'gcashQrImageUrl',
    ] as const,
  },
} as const;

const OTP_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_SENDS_PER_WINDOW = 3;
const SEND_RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

type CanonicalPaymentMethod = {
  id: string;
  provider: string;
  accountName: string;
  accountNumber: string;
  qrImageUrl: string | null;
  isPrimary: boolean;
};

export function canonicalizePaymentMethodsForFingerprint(
  methods: PropertyPaymentMethod[]
): CanonicalPaymentMethod[] {
  return methods
    .map((m) => ({
      id: String(m.id ?? '').trim(),
      provider: normalizePaymentProvider(m.provider),
      accountName: String(m.accountName ?? '').trim(),
      accountNumber: formatPaymentAccountNumberDisplay(
        normalizePaymentProvider(m.provider),
        String(m.accountNumber ?? '').trim()
      ),
      qrImageUrl: m.qrImageUrl?.trim() || null,
      isPrimary: m.isPrimary === true,
    }))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
}

export async function computePaymentSettingsFingerprint(
  methods: PropertyPaymentMethod[]
): Promise<string> {
  const canonical = canonicalizePaymentMethodsForFingerprint(methods);
  const json = JSON.stringify({ paymentMethods: canonical });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function patchBodyTouchesPaymentSettings(body: Record<string, unknown>): boolean {
  const keys = SENSITIVE_SETTINGS_ACTIONS[SETTINGS_VERIFICATION_ACTION].propertyPatchKeys;
  return keys.some((key) => key in body && body[key] !== undefined);
}

export function extractPaymentMethodsFromPatchBody(
  body: Record<string, unknown>
): PropertyPaymentMethod[] | null {
  if (!Array.isArray(body.paymentMethods)) return null;
  return body.paymentMethods as PropertyPaymentMethod[];
}

function verificationHmacKey(): Uint8Array {
  const raw =
    Deno.env.get('SETTINGS_VERIFICATION_SECRET')?.trim() ||
    Deno.env.get('GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY')?.trim() ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    'local-dev-settings-verification';
  return new TextEncoder().encode(raw);
}

async function importHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    webCryptoRawKey(verificationHmacKey()),
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

export type SettingsVerificationTokenPayload = {
  challengeId: string;
  action: SettingsVerificationAction;
  organizationId: string;
  propertyId?: string;
  parkingId?: string;
  patchFingerprint: string;
  exp: number;
};

export async function signSettingsVerificationToken(
  payload: Omit<SettingsVerificationTokenPayload, 'exp'> & { exp?: number }
): Promise<string> {
  const full: SettingsVerificationTokenPayload = {
    ...payload,
    exp: payload.exp ?? Date.now() + TOKEN_TTL_MS,
  };
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(full)));
  const key = await importHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifySettingsVerificationToken(
  token: string
): Promise<SettingsVerificationTokenPayload | null> {
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
    const parsed = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(body))
    ) as SettingsVerificationTokenPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    if (parsed.action !== SETTINGS_VERIFICATION_ACTION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function generateOtpCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(6, '0');
}

export async function hashOtpCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.trim()));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function maskOwnerEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const maskedLocal =
    local.length <= 1 ? '*' : `${local[0]}${'*'.repeat(Math.min(3, local.length - 1))}`;
  return `${maskedLocal}@${domain}`;
}

export async function assertSettingsVerificationRateLimit(
  supabase: SupabaseClient,
  requestedBy: string,
  organizationId: string
): Promise<void> {
  const since = new Date(Date.now() - SEND_RATE_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from('settings_verification_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('requested_by', requestedBy)
    .eq('organization_id', organizationId)
    .gte('created_at', since);
  if (error) {
    console.error('[settingsVerification] rate limit check failed', error.message);
    throw new Error('Could not send verification code');
  }
  if ((count ?? 0) >= MAX_OTP_SENDS_PER_WINDOW) {
    throw new Error('Too many verification codes sent. Try again in a few minutes.');
  }
}

export async function invalidateOpenChallenges(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    propertyId?: string | null;
    parkingId?: string | null;
    action: SettingsVerificationAction;
    patchFingerprint: string;
  }
): Promise<void> {
  let query = supabase
    .from('settings_verification_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('organization_id', input.organizationId)
    .eq('action', input.action)
    .eq('patch_fingerprint', input.patchFingerprint)
    .is('consumed_at', null);

  if (input.propertyId) query = query.eq('property_id', input.propertyId);
  if (input.parkingId) query = query.eq('parking_id', input.parkingId);

  const { error } = await query;
  if (error) {
    console.warn('[settingsVerification] invalidateOpenChallenges:', error.message);
  }
}

export async function createSettingsVerificationChallenge(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    propertyId?: string | null;
    parkingId?: string | null;
    action: SettingsVerificationAction;
    patchFingerprint: string;
    requestedBy: string;
  }
): Promise<{ challengeId: string; code: string; expiresAt: string }> {
  await invalidateOpenChallenges(supabase, input);
  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from('settings_verification_challenges')
    .insert({
      organization_id: input.organizationId,
      property_id: input.propertyId ?? null,
      parking_id: input.parkingId ?? null,
      action: input.action,
      patch_fingerprint: input.patchFingerprint,
      code_hash: codeHash,
      requested_by: input.requestedBy,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    console.error('[settingsVerification] create challenge failed', error?.message);
    throw new Error('Could not create verification challenge');
  }

  return { challengeId: data.id as string, code, expiresAt };
}

export async function verifySettingsVerificationChallenge(
  supabase: SupabaseClient,
  input: { challengeId: string; code: string; requestedBy: string }
): Promise<{
  organizationId: string;
  propertyId: string | null;
  parkingId: string | null;
  action: SettingsVerificationAction;
  patchFingerprint: string;
}> {
  const { data: row, error } = await supabase
    .from('settings_verification_challenges')
    .select('*')
    .eq('id', input.challengeId)
    .maybeSingle();

  if (error || !row) {
    throw new Error('Invalid or expired verification code');
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

  const expectedHash = row.code_hash as string;
  const actualHash = await hashOtpCode(input.code);
  if (expectedHash !== actualHash) {
    await supabase
      .from('settings_verification_challenges')
      .update({ failed_attempts: (row.failed_attempts as number) + 1 })
      .eq('id', input.challengeId);
    throw new Error('Invalid verification code');
  }

  const { error: consumeError } = await supabase
    .from('settings_verification_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', input.challengeId)
    .is('consumed_at', null);

  if (consumeError) {
    throw new Error('Verification code already used');
  }

  return {
    organizationId: row.organization_id as string,
    propertyId: (row.property_id as string | null) ?? null,
    parkingId: (row.parking_id as string | null) ?? null,
    action: row.action as SettingsVerificationAction,
    patchFingerprint: row.patch_fingerprint as string,
  };
}

export async function requireSettingsVerificationToken(input: {
  token: string | undefined | null;
  organizationId: string;
  propertyId?: string | null;
  parkingId?: string | null;
  patchFingerprint: string;
}): Promise<void> {
  const trimmed = input.token?.trim();
  if (!trimmed) {
    throw new Error('Verification required. Confirm with the org owner email code.');
  }

  const payload = await verifySettingsVerificationToken(trimmed);
  if (!payload) {
    throw new Error('Invalid or expired verification token');
  }

  if (payload.organizationId !== input.organizationId) {
    throw new Error('Verification token does not match this organization');
  }

  if (input.propertyId && payload.propertyId !== input.propertyId) {
    throw new Error('Verification token does not match this property');
  }

  if (input.parkingId && payload.parkingId !== input.parkingId) {
    throw new Error('Verification token does not match this parking listing');
  }

  if (payload.patchFingerprint !== input.patchFingerprint) {
    throw new Error('Verification token does not match these payment changes');
  }
}

export { OTP_TTL_MS, TOKEN_TTL_MS, MAX_FAILED_ATTEMPTS };
