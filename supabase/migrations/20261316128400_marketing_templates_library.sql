-- Marketing Studio library: designs vs templates, size groups, Recently deleted.
--
-- Plan: docs/workflow/in-progress/marketing-studio-library-and-workspace-redesign.md
--
-- * kind               'design' (the host's work, autosaves) | 'template' (frozen copy saved
--                      with "Save as template"). Every existing row is a design.
-- * group_id           ties the same design in different sizes (AI runs, "Copy to another size").
-- * source_template_id the template a design started from ('preset:<id>' or 'tpl:<uuid>').
-- * deleted_at         Recently deleted (restorable for 30 days, then purged by cron).
--
-- Backfill never deletes or rewrites design_json: hidden per-preset autosaves simply become
-- visible designs, and legacy rows without a theme get the key the client already derives.

ALTER TABLE public.marketing_templates
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'design',
  ADD COLUMN IF NOT EXISTS group_id UUID,
  ADD COLUMN IF NOT EXISTS source_template_id TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketing_templates_kind_check'
  ) THEN
    ALTER TABLE public.marketing_templates
      ADD CONSTRAINT marketing_templates_kind_check CHECK (kind IN ('design', 'template'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.marketing_templates.kind IS
  'design = the host''s work (autosaves by id); template = frozen copy from "Save as template".';
COMMENT ON COLUMN public.marketing_templates.group_id IS
  'Same design in several sizes (AI runs, Copy to another size). NULL = a group of one.';
COMMENT ON COLUMN public.marketing_templates.source_template_id IS
  'Template a design started from: preset:<id> (built-in) or tpl:<uuid> (saved template).';
COMMENT ON COLUMN public.marketing_templates.deleted_at IS
  'Soft delete (Recently deleted). Rows are purged 30 days later by cron.';

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Metadata only: keep updated_at so "Last edited" order survives the migration.
ALTER TABLE public.marketing_templates DISABLE TRIGGER update_marketing_templates_updated_at;

-- 1. Size groups from AI runs. Non-UUID legacy ids ("ai-<ts>") hash to a stable UUID.
UPDATE public.marketing_templates
SET group_id = CASE
  WHEN (design_json->>'aiGenerationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (design_json->>'aiGenerationId')::uuid
  ELSE md5(design_json->>'aiGenerationId')::uuid
END
WHERE group_id IS NULL
  AND COALESCE(design_json->>'aiGenerationId', '') <> '';

-- 2. Where each design started.
UPDATE public.marketing_templates
SET source_template_id = 'preset:' || (design_json->>'sourcePresetId')
WHERE source_template_id IS NULL
  AND content_type = 'calendar'
  AND COALESCE(design_json->>'sourcePresetId', '') NOT IN ('', 'custom', 'default');

-- Post presets have one id per size (promo-500-off-instagram-post): keep the base id so
-- "used this template" matches across sizes.
UPDATE public.marketing_templates
SET source_template_id = 'preset:' || regexp_replace(
  design_json->>'templateId',
  '-(instagram-post|instagram-portrait|instagram-story|facebook-post)$',
  ''
)
WHERE source_template_id IS NULL
  AND content_type IN ('design', 'video')
  AND COALESCE(design_json->>'aiGenerated', 'false') <> 'true'
  AND (design_json->>'templateId') ~ '^[a-z0-9][a-z0-9-]{0,79}$'
  AND (design_json->>'templateId') NOT LIKE 'ai-%';

-- 3. Legacy rows without a theme: same rule as effectiveTemplateThemeKey() on the client.
UPDATE public.marketing_templates
SET theme_key = CASE
  WHEN content_type = 'calendar'
    AND design_json->>'sourcePresetId' IN (
      'social-availability', 'sunrise-select', 'desk-type', 'magazine-grid', 'bauhaus-geo',
      'memphis-print', 'boho-soft', 'garden-glow', 'property-hero', 'cabin-retreat',
      'velvet-guest', 'gold-foil', 'ring-bloom', 'petal-note'
    )
    THEN 'starter:' || (design_json->>'sourcePresetId')
  ELSE 'property-colors'
END
WHERE theme_key IS NULL;

ALTER TABLE public.marketing_templates ENABLE TRIGGER update_marketing_templates_updated_at;

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_marketing_templates_library
  ON public.marketing_templates (property_id, content_type, kind, theme_key, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_templates_deleted
  ON public.marketing_templates (property_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_templates_group
  ON public.marketing_templates (group_id)
  WHERE group_id IS NOT NULL;

-- ── updated_at: soft delete / restore is not an edit ────────────────────────
-- Same as 20261316127200 plus deleted_at, so a restored item keeps its place.
CREATE OR REPLACE FUNCTION public.marketing_templates_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (to_jsonb(NEW) - 'updated_at' - 'thumbnail_path' - 'design_json' - 'deleted_at')
       IS NOT DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'thumbnail_path' - 'design_json' - 'deleted_at')
     AND (NEW.design_json - 'thumbnailDataUrl') IS NOT DISTINCT FROM (OLD.design_json - 'thumbnailDataUrl')
  THEN
    NEW.updated_at = OLD.updated_at;
  ELSE
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- ── Library listing ─────────────────────────────────────────────────────────
-- One card per size group (its most recently edited size), keyset-paginated, without
-- design_json. Called by the marketing-templates edge function (service role) only.
CREATE OR REPLACE FUNCTION public.list_marketing_library(
  p_property_id UUID,
  p_content_type TEXT,
  p_kind TEXT DEFAULT 'design',
  p_theme_key TEXT DEFAULT NULL,
  p_query TEXT DEFAULT NULL,
  p_aspect TEXT DEFAULT NULL,
  p_deleted BOOLEAN DEFAULT FALSE,
  p_sort TEXT DEFAULT 'updated',
  p_cursor_key TEXT DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 24
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  kind TEXT,
  content_type TEXT,
  platform TEXT,
  aspect_preset TEXT,
  theme_key TEXT,
  group_id UUID,
  source_template_id TEXT,
  thumbnail_path TEXT,
  ai_generated BOOLEAN,
  is_collage BOOLEAN,
  theme_hash TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  group_size INTEGER,
  group_members JSONB,
  sort_key TEXT,
  preview_styles JSONB
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT t.*, COALESCE(t.group_id, t.id) AS gkey
    FROM public.marketing_templates t
    WHERE t.property_id = p_property_id
      AND t.content_type = p_content_type
      AND t.kind = p_kind
      AND (CASE WHEN p_deleted THEN t.deleted_at IS NOT NULL ELSE t.deleted_at IS NULL END)
      AND (p_theme_key IS NULL OR t.theme_key = p_theme_key)
  ),
  grouped AS (
    SELECT
      s.gkey,
      COUNT(*)::INTEGER AS group_size,
      jsonb_agg(
        jsonb_build_object('id', s.id, 'aspectPreset', s.aspect_preset, 'updatedAt', s.updated_at)
        ORDER BY s.updated_at DESC, s.id DESC
      ) AS group_members
    FROM scoped s
    GROUP BY s.gkey
  ),
  reps AS (
    SELECT DISTINCT ON (s.gkey) s.*
    FROM scoped s
    ORDER BY s.gkey, s.updated_at DESC, s.id DESC
  ),
  keyed AS (
    SELECT
      r.*,
      g.group_size,
      g.group_members,
      CASE p_sort
        WHEN 'name' THEN lower(r.name)
        WHEN 'created' THEN to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
        ELSE to_char(
          COALESCE(CASE WHEN p_deleted THEN r.deleted_at END, r.updated_at) AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US'
        )
      END AS sort_key
    FROM reps r
    JOIN grouped g ON g.gkey = r.gkey
    WHERE (p_query IS NULL OR r.name ILIKE '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%')
      AND (
        p_aspect IS NULL
        OR g.group_members @> jsonb_build_array(jsonb_build_object('aspectPreset', p_aspect))
      )
  )
  SELECT
    k.id,
    k.name,
    k.kind,
    k.content_type,
    k.platform,
    k.aspect_preset,
    k.theme_key,
    k.group_id,
    k.source_template_id,
    k.thumbnail_path,
    COALESCE(k.design_json->>'aiGenerated', 'false') = 'true' AS ai_generated,
    (k.design_json->'polotno'->'custom'->'collage') IS NOT NULL AS is_collage,
    k.design_json->>'themeHash' AS theme_hash,
    k.created_at,
    k.updated_at,
    k.deleted_at,
    k.group_size,
    k.group_members,
    k.sort_key,
    -- Calendars without a stored thumbnail draw from their styles (a light SVG on the card).
    CASE
      WHEN k.content_type = 'calendar' AND k.thumbnail_path IS NULL THEN k.design_json->'styles'
    END AS preview_styles
  FROM keyed k
  WHERE p_cursor_key IS NULL
     OR (
       CASE WHEN p_sort = 'name'
         THEN (k.sort_key, k.id) > (p_cursor_key, p_cursor_id)
         ELSE (k.sort_key, k.id) < (p_cursor_key, p_cursor_id)
       END
     )
  ORDER BY
    CASE WHEN p_sort = 'name' THEN k.sort_key END ASC,
    CASE WHEN p_sort = 'name' THEN k.id END ASC,
    CASE WHEN p_sort <> 'name' THEN k.sort_key END DESC,
    CASE WHEN p_sort <> 'name' THEN k.id END DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 61);
$$;

COMMENT ON FUNCTION public.list_marketing_library IS
  'Marketing Studio Library page: one row per size group, newest first (or by name / '
  'created), keyset cursor (sort_key, id). Service role only (marketing-templates edge).';

REVOKE ALL ON FUNCTION public.list_marketing_library(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, UUID, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_marketing_library(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, UUID, INTEGER
) TO service_role;

-- Templates the host used recently in a theme ("Used 2x" + Continue / Start new).
CREATE OR REPLACE FUNCTION public.marketing_template_usage(
  p_property_id UUID,
  p_content_type TEXT,
  p_theme_key TEXT,
  p_since TIMESTAMPTZ
)
RETURNS TABLE (
  source_template_id TEXT,
  use_count INTEGER,
  latest_id UUID,
  latest_name TEXT,
  latest_aspect_preset TEXT,
  latest_updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH recent AS (
    SELECT t.*
    FROM public.marketing_templates t
    WHERE t.property_id = p_property_id
      AND t.content_type = p_content_type
      AND t.kind = 'design'
      AND t.deleted_at IS NULL
      AND t.source_template_id IS NOT NULL
      AND (p_theme_key IS NULL OR t.theme_key = p_theme_key)
      AND t.updated_at >= p_since
  )
  SELECT DISTINCT ON (r.source_template_id)
    r.source_template_id,
    (COUNT(*) OVER (PARTITION BY r.source_template_id))::INTEGER AS use_count,
    r.id AS latest_id,
    r.name AS latest_name,
    r.aspect_preset AS latest_aspect_preset,
    r.updated_at AS latest_updated_at
  FROM recent r
  ORDER BY r.source_template_id, r.updated_at DESC, r.id DESC;
$$;

REVOKE ALL ON FUNCTION public.marketing_template_usage(UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_template_usage(UUID, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

-- ── Recently deleted purge (daily) ──────────────────────────────────────────
-- Pure SQL (no pg_net): rows go 30 days after delete. Their Storage thumbnails are removed
-- by the edge function's lazy purge when the host next lists the Library; any thumbnail
-- left behind is an unreferenced object (harmless).
CREATE OR REPLACE FUNCTION public.purge_deleted_marketing_templates()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gone AS (
    DELETE FROM public.marketing_templates
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days'
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER FROM gone;
$$;

REVOKE ALL ON FUNCTION public.purge_deleted_marketing_templates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_deleted_marketing_templates() TO service_role;

CREATE OR REPLACE FUNCTION public.sync_marketing_templates_purge_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '17 3 * * *';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pg_cron extension not installed');
  END IF;

  FOR r IN
    SELECT jobname FROM cron.job WHERE jobname = 'marketing-templates-purge-daily'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule(
    'marketing-templates-purge-daily',
    cron_expr,
    'SELECT public.purge_deleted_marketing_templates();'
  );

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_marketing_templates_purge_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_marketing_templates_purge_cron_job() IS
  'Rebuilds the marketing-templates-purge-daily cron job (03:17 UTC). SECURITY DEFINER; '
  'service_role only. Safe when pg_cron is missing.';

REVOKE ALL ON FUNCTION public.sync_marketing_templates_purge_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_marketing_templates_purge_cron_job() TO service_role;

SELECT public.sync_marketing_templates_purge_cron_job();
