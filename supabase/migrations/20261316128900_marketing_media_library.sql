-- Marketing media library (docs/workflow/in-progress/marketing-video-editor-multitrack.md) — Phase 1.
--
-- T1.1  `marketing-media` bucket (public, content-addressed paths, 150 MiB).
-- T1.2  `marketing_media_assets` table (service-role only; edge functions are the access layer).
-- T1.3  `reserve_marketing_media_upload` RPC (advisory-locked quota check) +
--       `marketing_media_usage` SQL function.
--
-- Idempotent where practical. No SVG / HTML MIME types are allowed.

-- ---------------------------------------------------------------------------
-- T1.1 Bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketing-media',
  'marketing-media',
  true,
  157286400, -- 150 MiB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/ogg', 'audio/webm'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- T1.2 Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'upload',
  bucket TEXT NOT NULL DEFAULT 'marketing-media',
  storage_path TEXT NOT NULL,
  poster_path TEXT,
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  reserved_bytes BIGINT NOT NULL DEFAULT 0,
  size_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  content_hash TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  purge_after TIMESTAMPTZ,
  CONSTRAINT marketing_media_assets_kind_check CHECK (kind IN ('image', 'video', 'audio')),
  CONSTRAINT marketing_media_assets_status_check CHECK (
    status IN ('pending', 'ready', 'failed', 'deleted')
  ),
  CONSTRAINT marketing_media_assets_source_check CHECK (
    source IN ('upload', 'ai', 'legacy_upload', 'music_upload')
  ),
  CONSTRAINT marketing_media_assets_meta_size_check CHECK (pg_column_size(meta) <= 8192),
  CONSTRAINT marketing_media_assets_bytes_check CHECK (
    reserved_bytes >= 0 AND (size_bytes IS NULL OR size_bytes >= 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_media_assets_storage_path_key
  ON public.marketing_media_assets (bucket, storage_path);

-- Dedupe: one ready asset per content hash per property.
CREATE UNIQUE INDEX IF NOT EXISTS marketing_media_assets_property_hash_key
  ON public.marketing_media_assets (property_id, content_hash)
  WHERE status = 'ready' AND content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS marketing_media_assets_property_status_created_idx
  ON public.marketing_media_assets (property_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS marketing_media_assets_property_kind_status_idx
  ON public.marketing_media_assets (property_id, kind, status);

CREATE INDEX IF NOT EXISTS marketing_media_assets_status_purge_idx
  ON public.marketing_media_assets (status, purge_after);

CREATE INDEX IF NOT EXISTS marketing_media_assets_pending_created_idx
  ON public.marketing_media_assets (status, created_at)
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS marketing_media_assets_updated_at ON public.marketing_media_assets;
CREATE TRIGGER marketing_media_assets_updated_at
  BEFORE UPDATE ON public.marketing_media_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.marketing_media_assets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_media_assets TO service_role;

COMMENT ON TABLE public.marketing_media_assets IS
  'Host media library for Marketing Studio (images, video, audio). Quota-counted for source upload/legacy_upload/music_upload; access via marketing-media edge function only.';
COMMENT ON COLUMN public.marketing_media_assets.reserved_bytes IS
  'Bytes reserved at reserve time; size_bytes (from storage.objects) replaces it at finalize.';
COMMENT ON COLUMN public.marketing_media_assets.source IS
  'ai rows link generation outputs and are not quota-counted; legacy_upload rows point at pre-library objects (not moved).';

-- ---------------------------------------------------------------------------
-- T1.3 Usage function (quota-counted rows only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketing_media_usage(p_property_id UUID)
RETURNS TABLE (used_bytes BIGINT, files BIGINT, uploads_today BIGINT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(
      SUM(COALESCE(size_bytes, reserved_bytes))
        FILTER (
          WHERE status IN ('pending', 'ready')
            AND source IN ('upload', 'legacy_upload', 'music_upload')
        ),
      0
    )::BIGINT,
    COUNT(*) FILTER (
      WHERE status IN ('pending', 'ready')
        AND source IN ('upload', 'legacy_upload', 'music_upload')
    )::BIGINT,
    COUNT(*) FILTER (
      WHERE source IN ('upload', 'music_upload')
        AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila')
    )::BIGINT
  FROM public.marketing_media_assets
  WHERE property_id = p_property_id;
$$;

REVOKE ALL ON FUNCTION public.marketing_media_usage(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_media_usage(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- T1.3 Reserve RPC
--
-- p_limits keys (all numbers; bytes unless noted):
--   storageBytes, maxFiles, maxFileBytes, maxVideoSec, dailyUploads
-- The edge function resolves them from `marketingMediaLibrary` plan features
-- (MB -> bytes) and passes them in, so plan edits never need a migration.
--
-- Returns a single row: asset_id (set on success) or error_code:
--   file_too_large | video_too_long | storage_full | too_many_files | daily_limit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_marketing_media_upload(
  p_org_id UUID,
  p_property_id UUID,
  p_kind TEXT,
  p_bytes BIGINT,
  p_duration_ms INTEGER,
  p_hash TEXT,
  p_limits JSONB,
  p_storage_path TEXT,
  p_poster_path TEXT DEFAULT NULL,
  p_mime_type TEXT DEFAULT '',
  p_file_name TEXT DEFAULT '',
  p_source TEXT DEFAULT 'upload',
  p_created_by UUID DEFAULT NULL,
  p_asset_id UUID DEFAULT NULL
)
RETURNS TABLE (asset_id UUID, error_code TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_used BIGINT;
  v_files BIGINT;
  v_today BIGINT;
  v_id UUID;
  v_storage BIGINT := COALESCE((p_limits->>'storageBytes')::BIGINT, 0);
  v_max_files BIGINT := COALESCE((p_limits->>'maxFiles')::BIGINT, 0);
  v_max_file BIGINT := COALESCE((p_limits->>'maxFileBytes')::BIGINT, 0);
  v_max_sec BIGINT := COALESCE((p_limits->>'maxVideoSec')::BIGINT, 0);
  v_daily BIGINT := COALESCE((p_limits->>'dailyUploads')::BIGINT, 0);
BEGIN
  IF p_kind NOT IN ('image', 'video', 'audio') THEN
    RAISE EXCEPTION 'invalid kind: %', p_kind;
  END IF;
  IF p_source NOT IN ('upload', 'music_upload') THEN
    RAISE EXCEPTION 'invalid source for reserve: %', p_source;
  END IF;
  IF p_bytes IS NULL OR p_bytes <= 0 THEN
    RAISE EXCEPTION 'bytes must be positive';
  END IF;

  -- Serialize reservations per property so parallel tabs cannot over-reserve.
  PERFORM pg_advisory_xact_lock(hashtext(p_property_id::text));

  IF p_bytes > v_max_file THEN
    RETURN QUERY SELECT NULL::UUID, 'file_too_large'::TEXT;
    RETURN;
  END IF;

  IF p_kind = 'video'
     AND p_duration_ms IS NOT NULL
     AND p_duration_ms > v_max_sec * 1000 THEN
    RETURN QUERY SELECT NULL::UUID, 'video_too_long'::TEXT;
    RETURN;
  END IF;

  SELECT u.used_bytes, u.files, u.uploads_today
  INTO v_used, v_files, v_today
  FROM public.marketing_media_usage(p_property_id) u;

  IF v_today >= v_daily THEN
    RETURN QUERY SELECT NULL::UUID, 'daily_limit'::TEXT;
    RETURN;
  END IF;
  IF v_files >= v_max_files THEN
    RETURN QUERY SELECT NULL::UUID, 'too_many_files'::TEXT;
    RETURN;
  END IF;
  IF v_used + p_bytes > v_storage THEN
    RETURN QUERY SELECT NULL::UUID, 'storage_full'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.marketing_media_assets (
    id, org_id, property_id, kind, status, source, storage_path, poster_path,
    file_name, mime_type, reserved_bytes, duration_ms, content_hash, created_by
  )
  VALUES (
    COALESCE(p_asset_id, gen_random_uuid()), p_org_id, p_property_id, p_kind, 'pending', p_source, p_storage_path, p_poster_path,
    COALESCE(p_file_name, ''), COALESCE(p_mime_type, ''), p_bytes, p_duration_ms, p_hash, p_created_by
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_marketing_media_upload(
  UUID, UUID, TEXT, BIGINT, INTEGER, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_marketing_media_upload(
  UUID, UUID, TEXT, BIGINT, INTEGER, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID
) TO service_role;
