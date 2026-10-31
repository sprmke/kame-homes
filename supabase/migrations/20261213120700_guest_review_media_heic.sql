-- Media optimization (docs/workflow/planned/image-video-upload-optimization.md) — Phase 2.
--
-- Guest review media now goes through the client CONTENT preset (→ WebP) and
-- passes an undecodable iPhone HEIC straight through. The bucket already allows
-- WebP + short-video types; add HEIC/HEIF so a pass-through fallback never hits
-- a bucket-level 400 before `validateGuestReviewMedia` runs its friendlier check.
--
-- Idempotent: plain UPDATE against an existing row, no-op if the bucket is absent.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm'
]::text[]
WHERE id = 'guest-review-media';
