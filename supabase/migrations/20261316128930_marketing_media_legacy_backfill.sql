-- Marketing media library — Phase 1 (T1.12): backfill existing uploads as `legacy_upload` rows.
--
-- Objects are NOT moved: each row points at the existing bucket + path, so saved designs and
-- videos that reference those URLs keep working. They count toward the property quota (they are
-- host uploads that were never capped), but an over-quota property is only blocked from NEW
-- uploads, never from reading or using these.
--
-- Covered prefixes in `property-media`:
--   marketing-uploads/{propertyId}/{file}        Posts canvas uploads (upload-marketing-asset, legacy)
--   {propertyId}/marketing-audio/{file}          video music uploads and URL imports
-- Jamendo cache files (`marketing-audio/jamendo-*`) are platform-curated and excluded.
--
-- Idempotent: ON CONFLICT (bucket, storage_path) DO NOTHING. Safe to re-run after a restore.

INSERT INTO public.marketing_media_assets (
  org_id, property_id, kind, status, source, bucket, storage_path,
  file_name, mime_type, reserved_bytes, size_bytes, created_at
)
SELECT
  p.organization_id,
  p.id,
  m.kind,
  'ready',
  'legacy_upload',
  'property-media',
  o.name,
  regexp_replace(o.name, '^.*/', ''),
  m.mime,
  m.size,
  m.size,
  o.created_at
FROM storage.objects o
CROSS JOIN LATERAL (
  SELECT
    COALESCE(
      CASE
        WHEN o.name LIKE 'marketing-uploads/%'
          THEN substring(o.name FROM '^marketing-uploads/([0-9a-fA-F-]{36})/')
        ELSE substring(o.name FROM '^([0-9a-fA-F-]{36})/marketing-audio/')
      END,
      ''
    ) AS property_text
) AS path_parts
JOIN public.properties p
  ON path_parts.property_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND p.id = path_parts.property_text::uuid
CROSS JOIN LATERAL (
  SELECT
    COALESCE(o.metadata->>'mimetype', '') AS mime,
    COALESCE((o.metadata->>'size')::BIGINT, 0) AS size,
    CASE
      WHEN COALESCE(o.metadata->>'mimetype', '') LIKE 'image/%' THEN 'image'
      WHEN COALESCE(o.metadata->>'mimetype', '') LIKE 'video/%' THEN 'video'
      WHEN COALESCE(o.metadata->>'mimetype', '') LIKE 'audio/%' THEN 'audio'
      WHEN o.name ~* '\.(jpe?g|png|webp|heic|heif|avif|gif)$' THEN 'image'
      WHEN o.name ~* '\.(mp4|mov|webm)$' THEN 'video'
      WHEN o.name ~* '\.(mp3|m4a|aac|wav|ogg)$' THEN 'audio'
      ELSE NULL
    END AS kind
) AS m
WHERE o.bucket_id = 'property-media'
  AND (o.name LIKE 'marketing-uploads/%' OR o.name LIKE '%/marketing-audio/%')
  AND o.name NOT LIKE '%/marketing-audio/jamendo-%'
  AND m.kind IS NOT NULL
ON CONFLICT (bucket, storage_path) DO NOTHING;
