-- Media optimization (docs/workflow/planned/image-video-upload-optimization.md) — Phase 0.
--
-- Client-side compression now emits WebP for photos/content/avatars and passes
-- through the *original* (which may be HEIC from an iPhone) when it cannot be
-- decoded. Widen every media bucket's allow-list so those never hit a
-- bucket-level 400 before the edge function's own (friendlier) check runs, and
-- raise `file_size_limit` to at least the unified ceilings in
-- `supabase/functions/_shared/uploadLimits.ts` (image 10MB, document/pdf 12MB,
-- video 50MB).
--
-- Idempotent: plain UPDATEs against existing rows, no-ops if a bucket is absent.

-- Guest booking-form document buckets (were image/png + image/jpeg only, 5MB).
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'
  ]::text[],
  file_size_limit = 12582912 -- 12 MB (document)
WHERE id IN ('valid-ids', 'payment-receipts', 'pet-vaccinations');

-- Pet photo bucket — CONTENT preset → WebP (were image/png + image/jpeg, 5MB).
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'
  ]::text[],
  file_size_limit = 10485760 -- 10 MB (image)
WHERE id = 'pet-images';

-- Parking / SD-refund document buckets — already allow webp + pdf; add HEIC
-- pass-through and lift the ceiling to the document limit.
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
  ]::text[],
  file_size_limit = 12582912 -- 12 MB (document)
WHERE id IN ('parking-endorsements', 'sd-refund-receipts');

-- Settings / verification / listing / chat image buckets — already allow webp;
-- add HEIC pass-through and lift the ceiling so a non-optimized fallback gets
-- the edge function's message instead of a generic bucket rejection.
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
  ]::text[],
  file_size_limit = 12582912 -- 12 MB
WHERE id IN (
  'org-verification-assets',
  'listing-authorization-assets',
  'guest-chat-attachments',
  'app-settings-assets'
);

-- Guest avatar bucket — AVATAR preset stays <= 5MB; add HEIC pass-through.
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'
  ]::text[]
WHERE id = 'guest-profile-assets';

-- Buckets that also hold video — raise to the unified 50MB video ceiling.
UPDATE storage.buckets
SET file_size_limit = 52428800 -- 50 MB
WHERE id IN ('property-media', 'guest-review-media', 'support-ticket-attachments');
