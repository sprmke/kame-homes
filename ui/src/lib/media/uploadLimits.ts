/**
 * uploadLimits — single client source of truth for upload size ceilings, accept
 * strings, and pre-upload validation.
 *
 * ⚠️  Keep the numbers + error strings in sync with the edge mirror
 *     `supabase/functions/_shared/uploadLimits.ts`. There is a parity unit test
 *     (`uploadLimits.test.ts`) that imports both and asserts they match.
 *
 * These ceilings are a *safety net*, not the mechanism that shrinks files — that
 * is `imageOptimization.ts`, which runs client-side before the upload. The
 * ceiling only exists to reject abuse / bypass (curl, stale JS, HEIC that could
 * not be decoded for compression). It is set generously on purpose: rejecting a
 * user's legitimate photo is a worse outcome than storing a slightly large file.
 */

export const UPLOAD_MAX_BYTES = {
  /** Photos, gallery, marketing, generic content images. */
  image: 10 * 1024 * 1024,
  /** Avatars, logos, small icons. */
  avatar: 5 * 1024 * 1024,
  /** ID / receipt / vaccination / signature images — near-lossless handling. */
  document: 12 * 1024 * 1024,
  /** PDF documents (never compressed). */
  pdf: 12 * 1024 * 1024,
  /** Video (never transcoded). */
  video: 50 * 1024 * 1024,
} as const;

export type UploadLimitKind = keyof typeof UPLOAD_MAX_BYTES;

/** Human-readable ceiling, e.g. `10 MB`. */
export function formatUploadLimit(kind: UploadLimitKind): string {
  return `${Math.round(UPLOAD_MAX_BYTES[kind] / (1024 * 1024))} MB`;
}

/**
 * Canonical "too large" message. Must byte-for-byte match the edge mirror's
 * `formatMaxBytesError` so the client and server surface identical copy.
 */
export function formatMaxBytesError(maxBytes: number): string {
  return `File must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller`;
}

/** `accept` attribute values per kind (what the user may *pick*). */
export const UPLOAD_ACCEPT = {
  image:
    'image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/gif,image/bmp,image/tiff',
  avatar: 'image/jpeg,image/png,image/webp',
  document: 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf',
  video: 'video/mp4,video/webm,video/quicktime',
  pdf: 'application/pdf',
} as const;

export type ValidateUploadResult = { ok: true } | { ok: false; message: string };

/**
 * Pre-upload sanity check. Only enforces the byte ceiling — MIME is the edge
 * function's job (it is the real trust boundary). Returns a result object rather
 * than throwing so callers can wire it straight into form error state.
 */
export function validateUploadFile(file: File, kind: UploadLimitKind): ValidateUploadResult {
  const max = UPLOAD_MAX_BYTES[kind];
  if (file.size > max) {
    return { ok: false, message: formatMaxBytesError(max) };
  }
  return { ok: true };
}
