-- Support ticket attachments: allow HEIC/HEIF pass-through (matches UI + guest-review-media pattern).

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime'
]::text[]
WHERE id = 'support-ticket-attachments';
