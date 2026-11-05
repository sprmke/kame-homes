/**
 * Review text content policy — length limits, contact-info/URL rejection,
 * whitespace normalization. Applies to guest review text, host review text,
 * private notes, internal notes, and both sides' responses.
 */

export const REVIEW_TEXT_MAX_LEN = 2000;
export const REVIEW_RESPONSE_MAX_LEN = 1000;
export const REVIEW_PRIVATE_NOTE_MAX_LEN = 1000;

const URL_RE = /(https?:\/\/|www\.)\S+/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// Loose phone pattern: 7+ digits with optional separators, to catch "0917 123 4567" etc.
const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/;

export function normalizeReviewText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

/** Returns an error message, or null when the text passes. `maxLen` defaults to review text length. */
export function validateReviewText(
  raw: string | null,
  opts: { maxLen?: number; fieldLabel?: string; allowContactInfo?: boolean } = {}
): string | null {
  if (!raw) return null;
  const maxLen = opts.maxLen ?? REVIEW_TEXT_MAX_LEN;
  const label = opts.fieldLabel ?? 'Review text';
  if (raw.length > maxLen) return `${label} must be ${maxLen} characters or fewer`;
  if (opts.allowContactInfo) return null;
  if (URL_RE.test(raw)) return `${label} can't include links`;
  if (EMAIL_RE.test(raw)) return `${label} can't include an email address`;
  if (PHONE_RE.test(raw)) return `${label} can't include a phone number`;
  return null;
}
