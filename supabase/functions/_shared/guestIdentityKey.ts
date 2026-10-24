/**
 * Guest identity key — cross-booking / cross-org guest reputation matching (D6).
 * `sha256(lower(trim(email)) + REVIEW_IDENTITY_PEPPER)`, or a per-booking
 * placeholder when there is no email (calendar-sync imports), so it never
 * collides with a real guest's key.
 */

const REVIEW_IDENTITY_PEPPER_FALLBACK = 'kame-homes-review-identity-dev-pepper';

function reviewIdentityPepper(): string {
  return Deno.env.get('REVIEW_IDENTITY_PEPPER')?.trim() || REVIEW_IDENTITY_PEPPER_FALLBACK;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** `booking:<id>` placeholder — guaranteed never to match a real email-derived key. */
export function bookingPlaceholderIdentityKey(bookingId: string): string {
  return `booking:${bookingId}`;
}

/**
 * Computes the identity key for an email, or a booking placeholder when the
 * email is missing/blank (calendar-sync bookings with no guest email yet).
 */
export async function guestIdentityKey(
  email: string | null | undefined,
  bookingId: string
): Promise<string> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return bookingPlaceholderIdentityKey(bookingId);
  return sha256Hex(normalized + reviewIdentityPepper());
}

/** Identity key for a known email only (reputation lookups) — null when no email. */
export async function identityKeyForEmail(
  email: string | null | undefined
): Promise<string | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  return sha256Hex(normalized + reviewIdentityPepper());
}
