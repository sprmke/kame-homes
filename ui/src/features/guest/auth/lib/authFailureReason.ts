/**
 * Coarse reason for a failed sign-in attempt.
 *
 * `auth_failed` is an outcome, not a fault: a wrong OTP is a user mistake, and it must never
 * reach Sentry. The reason is an enum so the funnel can split "we rejected them" (expired,
 * not allowed) from "our provider broke" (provider_error) without reading error prose.
 *
 * Deliberately message-based: Supabase returns a human string and a status, not a stable
 * code, on the OTP paths. Unknown text falls back to `provider_error`, which is the bucket
 * worth looking at.
 */

export type AuthFailureReason =
  'otp_invalid' | 'otp_expired' | 'not_allowed' | 'cancelled' | 'provider_error';

export function classifyAuthFailure(message: string | null | undefined): AuthFailureReason {
  const text = (message ?? '').toLowerCase();
  if (!text) return 'provider_error';
  if (text.includes('expired')) return 'otp_expired';
  if (text.includes('invalid') || text.includes('incorrect') || text.includes('mismatch')) {
    return 'otp_invalid';
  }
  if (text.includes('not allowed') || text.includes('not authorized') || text.includes('denied')) {
    return 'not_allowed';
  }
  if (text.includes('cancel')) return 'cancelled';
  return 'provider_error';
}
