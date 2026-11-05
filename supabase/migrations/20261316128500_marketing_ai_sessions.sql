-- Marketing AI Studio conversations (plan: docs/workflow/in-progress/
-- marketing-ai-studio-sessions-and-library-polish.md §4).
--
-- A session is one conversation: the host's first request plus every refinement. Its
-- versions are the photo / clip jobs (marketing_generation_jobs.session_id) or the
-- post versions below. Existing jobs become one session each (same id as the job).

CREATE TABLE IF NOT EXISTS public.marketing_ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  output TEXT NOT NULL,
  CONSTRAINT marketing_ai_sessions_output_check CHECK (output IN ('post', 'image', 'video')),
  title TEXT NOT NULL,
  CONSTRAINT marketing_ai_sessions_title_len_check CHECK (char_length(title) BETWEEN 1 AND 120),
  theme_key TEXT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.marketing_ai_sessions IS
  'AI Studio conversation: one request and its refinements. Versions are jobs (photo / clip) or marketing_ai_post_versions.';
COMMENT ON COLUMN public.marketing_ai_sessions.updated_at IS
  'Bumped when a version is added or the title changes; orders the AI Studio home.';
COMMENT ON COLUMN public.marketing_ai_sessions.deleted_at IS
  'Soft delete (Recently deleted, 30 days).';

CREATE INDEX IF NOT EXISTS idx_marketing_ai_sessions_property_list
  ON public.marketing_ai_sessions (property_id, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_ai_sessions_property_deleted
  ON public.marketing_ai_sessions (property_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

DROP TRIGGER IF EXISTS update_marketing_ai_sessions_updated_at ON public.marketing_ai_sessions;
CREATE TRIGGER update_marketing_ai_sessions_updated_at
  BEFORE UPDATE ON public.marketing_ai_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.marketing_ai_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_ai_sessions FROM anon, authenticated;
GRANT ALL ON public.marketing_ai_sessions TO service_role;

-- ── Jobs belong to a session ───────────────────────────────────────────────
ALTER TABLE public.marketing_generation_jobs
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.marketing_ai_sessions (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_job_id UUID REFERENCES public.marketing_generation_jobs (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.marketing_generation_jobs.session_id IS
  'AI Studio conversation this version belongs to.';
COMMENT ON COLUMN public.marketing_generation_jobs.parent_job_id IS
  'The version this one refines (photo: its output was the first reference; clip: same start photo).';

CREATE INDEX IF NOT EXISTS idx_marketing_generation_jobs_session
  ON public.marketing_generation_jobs (session_id, created_at);

-- ── Post versions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_ai_post_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.marketing_ai_sessions (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  turn_id UUID NOT NULL,
  prompt TEXT,
  CONSTRAINT marketing_ai_post_versions_prompt_len_check
    CHECK (prompt IS NULL OR char_length(prompt) <= 500),
  goal TEXT NOT NULL,
  format TEXT NOT NULL,
  spec JSONB NOT NULL,
  CONSTRAINT marketing_ai_post_versions_spec_object_check CHECK (jsonb_typeof(spec) = 'object'),
  preview_path TEXT,
  parent_version_id UUID REFERENCES public.marketing_ai_post_versions (id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.marketing_ai_post_versions IS
  'AI Studio post versions. spec is the art-direction spec the client compiles; turn_id groups the versions one message produced (the first turn makes four).';

CREATE INDEX IF NOT EXISTS idx_marketing_ai_post_versions_session
  ON public.marketing_ai_post_versions (session_id, created_at);

ALTER TABLE public.marketing_ai_post_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_ai_post_versions FROM anon, authenticated;
GRANT ALL ON public.marketing_ai_post_versions TO service_role;

-- ── Backfill: one session per existing job ─────────────────────────────────
-- The jobs' updated_at trigger is paused so attaching a session does not look like
-- activity on old rows.
ALTER TABLE public.marketing_generation_jobs DISABLE TRIGGER update_marketing_generation_jobs_updated_at;

INSERT INTO public.marketing_ai_sessions (
  id, organization_id, property_id, output, title, created_by, created_at, updated_at
)
SELECT
  j.id,
  j.organization_id,
  j.property_id,
  j.media_type,
  COALESCE(
    NULLIF(
      left(btrim(regexp_replace(split_part(j.prompt, E'\n\nStyle:', 1), '\s+', ' ', 'g')), 60),
      ''
    ),
    CASE WHEN j.media_type = 'video' THEN 'Clip' ELSE 'Photo' END
  ),
  j.triggered_by,
  j.created_at,
  COALESCE(j.completed_at, j.created_at)
FROM public.marketing_generation_jobs j
WHERE j.session_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.marketing_generation_jobs j
SET session_id = j.id
WHERE j.session_id IS NULL;

ALTER TABLE public.marketing_generation_jobs ENABLE TRIGGER update_marketing_generation_jobs_updated_at;

-- ── AI Studio home list ────────────────────────────────────────────────────
-- One row per session with its cover (newest finished version) and counts. Keyset
-- on (updated_at, id) for the live list, (deleted_at, id) for Recently deleted.
CREATE OR REPLACE FUNCTION public.list_marketing_ai_sessions(
  p_property_id UUID,
  p_output TEXT,
  p_query TEXT,
  p_deleted BOOLEAN,
  p_cursor_at TIMESTAMPTZ,
  p_cursor_id UUID,
  p_limit INT
)
RETURNS TABLE (
  id UUID,
  output TEXT,
  title TEXT,
  theme_key TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  sort_at TIMESTAMPTZ,
  version_count INT,
  in_flight BOOLEAN,
  cover_url TEXT,
  cover_poster_url TEXT,
  cover_path TEXT,
  cover_media TEXT,
  cover_aspect TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.output,
    s.title,
    s.theme_key,
    s.created_at,
    s.updated_at,
    s.deleted_at,
    CASE WHEN p_deleted THEN s.deleted_at ELSE s.updated_at END AS sort_at,
    (
      (SELECT COUNT(*) FROM public.marketing_generation_jobs j WHERE j.session_id = s.id)
      + (SELECT COUNT(*) FROM public.marketing_ai_post_versions v WHERE v.session_id = s.id)
    )::INT AS version_count,
    EXISTS (
      SELECT 1 FROM public.marketing_generation_jobs j
      WHERE j.session_id = s.id AND j.job_status IN ('pending', 'processing', 'finalizing')
    ) AS in_flight,
    cover.url,
    cover.poster_url,
    cover.path,
    cover.media,
    cover.aspect
  FROM public.marketing_ai_sessions s
  LEFT JOIN LATERAL (
    SELECT c.url, c.poster_url, c.path, c.media, c.aspect
    FROM (
      SELECT
        j.output_url AS url,
        CASE WHEN j.media_type = 'video' THEN j.reference_urls[1] END AS poster_url,
        NULL::TEXT AS path,
        j.media_type AS media,
        j.aspect_ratio AS aspect,
        j.created_at AS at
      FROM public.marketing_generation_jobs j
      WHERE j.session_id = s.id AND j.job_status = 'completed' AND j.output_url IS NOT NULL
      UNION ALL
      SELECT NULL, NULL, v.preview_path, 'post', v.format, v.created_at
      FROM public.marketing_ai_post_versions v
      WHERE v.session_id = s.id AND v.preview_path IS NOT NULL
    ) c
    ORDER BY c.at DESC
    LIMIT 1
  ) cover ON TRUE
  WHERE s.property_id = p_property_id
    AND (CASE WHEN p_deleted THEN s.deleted_at IS NOT NULL ELSE s.deleted_at IS NULL END)
    AND (p_output IS NULL OR s.output = p_output)
    AND (p_query IS NULL OR s.title ILIKE '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%')
    AND (
      p_cursor_at IS NULL
      OR (CASE WHEN p_deleted THEN s.deleted_at ELSE s.updated_at END, s.id) < (p_cursor_at, p_cursor_id)
    )
  ORDER BY sort_at DESC, s.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 61);
$$;

REVOKE ALL ON FUNCTION public.list_marketing_ai_sessions(UUID, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, UUID, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_marketing_ai_sessions(UUID, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, UUID, INT)
  TO service_role;

-- ── Recently deleted purge (daily, pure SQL) ───────────────────────────────
-- Job outputs and post previews in Storage are removed by the edge function's lazy
-- purge when Recently deleted is listed; rows the SQL job removes first leave their
-- objects unreferenced (harmless).
CREATE OR REPLACE FUNCTION public.purge_deleted_marketing_ai_sessions()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gone AS (
    DELETE FROM public.marketing_ai_sessions
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days'
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER FROM gone;
$$;

REVOKE ALL ON FUNCTION public.purge_deleted_marketing_ai_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_deleted_marketing_ai_sessions() TO service_role;

CREATE OR REPLACE FUNCTION public.sync_marketing_ai_sessions_purge_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '27 3 * * *';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pg_cron extension not installed');
  END IF;

  FOR r IN
    SELECT jobname FROM cron.job WHERE jobname = 'marketing-ai-sessions-purge-daily'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule(
    'marketing-ai-sessions-purge-daily',
    cron_expr,
    'SELECT public.purge_deleted_marketing_ai_sessions();'
  );

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_marketing_ai_sessions_purge_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_marketing_ai_sessions_purge_cron_job() IS
  'Rebuilds the marketing-ai-sessions-purge-daily cron job (03:27 UTC). SECURITY DEFINER; '
  'service_role only. Safe when pg_cron is missing.';

REVOKE ALL ON FUNCTION public.sync_marketing_ai_sessions_purge_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_marketing_ai_sessions_purge_cron_job() TO service_role;

SELECT public.sync_marketing_ai_sessions_purge_cron_job();
