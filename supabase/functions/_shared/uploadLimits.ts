/**
 * uploadLimits (edge mirror) — the authoritative upload size ceiling enforced
 * server-side by every `upload-*` / `submit-*` function.
 *
 * ⚠️  Keep the numbers + error strings in sync with the client copy
 *     `ui/src/lib/media/uploadLimits.ts` (parity is covered by a unit test).
 *
 * Client-side `imageOptimization` shrinks images before they are sent; this
 * ceiling only rejects what bypassed or could not be optimized. It is
 * deliberately generous — see the client file's header for the rationale.
 *
 * Per-bucket `file_size_limit` in `supabase/config.toml` + the storage
 * migrations must be >= the matching ceiling here, or the platform rejects
 * first with a generic error.
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

/**
 * Canonical "too large" message. Must byte-for-byte match the client mirror's
 * `formatMaxBytesError`.
 */
export function formatMaxBytesError(maxBytes: number): string {
  return `File must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller`;
}

/** Human-readable ceiling, e.g. `10 MB`. */
export function formatUploadLimit(kind: UploadLimitKind): string {
  return `${Math.round(UPLOAD_MAX_BYTES[kind] / (1024 * 1024))} MB`;
}

/**
 * Throw a `File must be N MB or smaller` error if `file` exceeds the ceiling for
 * `kind`. Accepts anything with a numeric `size` (Deno `File`, Blob, or a plain
 * `{ size }` in tests).
 */
export function assertWithinUploadLimit(file: { size: number }, kind: UploadLimitKind): void {
  const max = UPLOAD_MAX_BYTES[kind];
  if (file.size > max) {
    throw new Error(formatMaxBytesError(max));
  }
}
