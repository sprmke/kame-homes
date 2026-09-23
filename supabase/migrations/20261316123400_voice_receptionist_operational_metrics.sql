-- Privacy-safe voice reliability metrics for the super-admin rollout dashboard.

ALTER TABLE public.voice_receptionist_sessions
  ADD COLUMN IF NOT EXISTS client_setup_ms INT,
  ADD COLUMN IF NOT EXISTS client_first_audio_ms INT,
  ADD COLUMN IF NOT EXISTS reconnect_count INT NOT NULL DEFAULT 0;

ALTER TABLE public.voice_receptionist_sessions
  ADD CONSTRAINT voice_receptionist_sessions_client_setup_check
    CHECK (client_setup_ms IS NULL OR client_setup_ms BETWEEN 0 AND 600000),
  ADD CONSTRAINT voice_receptionist_sessions_first_audio_check
    CHECK (client_first_audio_ms IS NULL OR client_first_audio_ms BETWEEN 0 AND 600000),
  ADD CONSTRAINT voice_receptionist_sessions_reconnect_count_check
    CHECK (reconnect_count BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS public.voice_receptionist_tool_metrics (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.voice_receptionist_sessions (id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  duration_ms INT NOT NULL CHECK (duration_ms BETWEEN 0 AND 600000),
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_receptionist_tool_metrics_created
  ON public.voice_receptionist_tool_metrics (created_at DESC);

ALTER TABLE public.voice_receptionist_tool_metrics ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.voice_receptionist_tool_metrics TO service_role;

CREATE OR REPLACE FUNCTION public.get_voice_receptionist_operational_metrics(p_days INT DEFAULT 7)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT NOW() - (LEAST(GREATEST(p_days, 1), 30) || ' days')::INTERVAL AS since
  ),
  sessions AS (
    SELECT *
    FROM public.voice_receptionist_sessions, bounds
    WHERE started_at >= bounds.since
  ),
  attempts AS (
    SELECT *
    FROM public.voice_receptionist_start_attempts, bounds
    WHERE created_at >= bounds.since
  ),
  tools AS (
    SELECT *
    FROM public.voice_receptionist_tool_metrics, bounds
    WHERE created_at >= bounds.since
  )
  SELECT jsonb_build_object(
    'days', LEAST(GREATEST(p_days, 1), 30),
    'sessions', (SELECT COUNT(*) FROM sessions),
    'startupMs', jsonb_build_object(
      'p50', (SELECT ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY client_setup_ms)) FROM sessions WHERE client_setup_ms IS NOT NULL),
      'p95', (SELECT ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY client_setup_ms)) FROM sessions WHERE client_setup_ms IS NOT NULL)
    ),
    'firstAudioMs', jsonb_build_object(
      'p50', (SELECT ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY client_first_audio_ms)) FROM sessions WHERE client_first_audio_ms IS NOT NULL),
      'p95', (SELECT ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY client_first_audio_ms)) FROM sessions WHERE client_first_audio_ms IS NOT NULL)
    ),
    'toolMs', jsonb_build_object(
      'p50', (SELECT ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)) FROM tools),
      'p95', (SELECT ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)) FROM tools)
    ),
    'sessionSeconds', jsonb_build_object(
      'p50', (SELECT ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_seconds)) FROM sessions WHERE duration_seconds IS NOT NULL),
      'p95', (SELECT ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_seconds)) FROM sessions WHERE duration_seconds IS NOT NULL)
    ),
    'reconnects', jsonb_build_object(
      'p50', (SELECT ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY reconnect_count)) FROM sessions),
      'p95', (SELECT ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY reconnect_count)) FROM sessions)
    ),
    'completionRatePct', (
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'ended') /
        NULLIF(COUNT(*) FILTER (WHERE status IN ('ended', 'failed', 'abandoned', 'expired')), 0),
        1
      )
      FROM sessions
    ),
    'alerts', jsonb_build_object(
      'providerFailureRateHigh', (
        SELECT COALESCE(
          100.0 * COUNT(*) FILTER (WHERE outcome = 'provider_failed') / NULLIF(COUNT(*), 0) >= 5,
          FALSE
        ) FROM attempts
      ),
      'reconnectRateHigh', (
        SELECT COALESCE(
          100.0 * COUNT(*) FILTER (WHERE reconnect_count > 0) / NULLIF(COUNT(*), 0) >= 10,
          FALSE
        ) FROM sessions
      ),
      'abandonmentRateHigh', (
        SELECT COALESCE(
          100.0 * COUNT(*) FILTER (WHERE status IN ('abandoned', 'expired')) / NULLIF(COUNT(*), 0) >= 5,
          FALSE
        ) FROM sessions
      ),
      'quotaPressureHigh', (
        SELECT COALESCE(
          100.0 * COUNT(*) FILTER (WHERE outcome = 'cap_denied') / NULLIF(COUNT(*), 0) >= 5,
          FALSE
        ) FROM attempts
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_voice_receptionist_operational_metrics(INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_voice_receptionist_operational_metrics(INT) TO service_role;
