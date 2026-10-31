-- Harden voice receptionist reservations, lifecycle, transcript storage, retention, and reaping.

ALTER TABLE public.voice_receptionist_sessions
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS provider_model TEXT,
  ADD COLUMN IF NOT EXISTS protocol_version TEXT,
  ADD COLUMN IF NOT EXISTS transcript_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS client_report_hash TEXT,
  ADD COLUMN IF NOT EXISTS transcript_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS usage_recorded_at TIMESTAMPTZ;

UPDATE public.voice_receptionist_sessions
SET
  status = CASE WHEN ended_at IS NULL THEN 'expired' ELSE 'ended' END,
  reserved_at = COALESCE(reserved_at, started_at),
  last_activity_at = COALESCE(last_activity_at, ended_at, started_at)
WHERE status IS NULL OR reserved_at IS NULL OR last_activity_at IS NULL;

ALTER TABLE public.voice_receptionist_sessions
  ALTER COLUMN status SET DEFAULT 'reserved',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN reserved_at SET DEFAULT NOW(),
  ALTER COLUMN reserved_at SET NOT NULL,
  ALTER COLUMN last_activity_at SET DEFAULT NOW(),
  ALTER COLUMN last_activity_at SET NOT NULL;

ALTER TABLE public.voice_receptionist_sessions
  DROP CONSTRAINT IF EXISTS voice_receptionist_sessions_status_check;
ALTER TABLE public.voice_receptionist_sessions
  ADD CONSTRAINT voice_receptionist_sessions_status_check CHECK (
    status IN ('reserved', 'connecting', 'active', 'ending', 'ended', 'failed', 'abandoned', 'expired')
  );

ALTER TABLE public.voice_receptionist_sessions
  DROP CONSTRAINT IF EXISTS voice_receptionist_sessions_transcript_status_check;
ALTER TABLE public.voice_receptionist_sessions
  ADD CONSTRAINT voice_receptionist_sessions_transcript_status_check CHECK (
    transcript_status IN ('none', 'client_reported', 'stored_unverified', 'discarded', 'failed')
  );

ALTER TABLE public.voice_receptionist_sessions
  DROP CONSTRAINT IF EXISTS voice_receptionist_sessions_end_reason_check;
ALTER TABLE public.voice_receptionist_sessions
  ADD CONSTRAINT voice_receptionist_sessions_end_reason_check CHECK (
    end_reason IS NULL OR end_reason IN (
      'guest_ended', 'timeout', 'cap_reached', 'error', 'provider_go_away',
      'provider_error', 'page_closed', 'idle_timeout', 'stale_reaper'
    )
  );

CREATE INDEX IF NOT EXISTS idx_voice_receptionist_sessions_active
  ON public.voice_receptionist_sessions (property_id, last_activity_at)
  WHERE status IN ('reserved', 'connecting', 'active', 'ending');

CREATE TABLE IF NOT EXISTS public.voice_receptionist_transcript_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.voice_receptionist_sessions (id) ON DELETE CASCADE,
  sequence INT NOT NULL CHECK (sequence >= 0 AND sequence < 200),
  role TEXT NOT NULL CHECK (role IN ('guest', 'assistant')),
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  occurred_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'client_reported' CHECK (source = 'client_reported'),
  trust TEXT NOT NULL DEFAULT 'unverified' CHECK (trust = 'unverified'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, sequence)
);

COMMENT ON TABLE public.voice_receptionist_transcript_turns IS
  'Bounded, unverified client evidence. Never authoritative outbound assistant messages.';

ALTER TABLE public.voice_receptionist_transcript_turns ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.voice_receptionist_transcript_turns TO service_role;

ALTER TABLE public.ai_platform_global_settings
  ADD COLUMN IF NOT EXISTS voice_receptionist_transcript_retention_days INT NOT NULL DEFAULT 30;
ALTER TABLE public.ai_platform_global_settings
  DROP CONSTRAINT IF EXISTS ai_platform_global_voice_transcript_retention_check;
ALTER TABLE public.ai_platform_global_settings
  ADD CONSTRAINT ai_platform_global_voice_transcript_retention_check
  CHECK (voice_receptionist_transcript_retention_days BETWEEN 1 AND 90);

CREATE OR REPLACE FUNCTION public.reserve_voice_receptionist_session(
  p_property_id UUID,
  p_guest_user_id UUID,
  p_conversation_id UUID,
  p_max_daily INT,
  p_max_concurrent INT,
  p_provider_model TEXT,
  p_protocol_version TEXT
)
RETURNS public.voice_receptionist_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily_count INT;
  v_concurrent_count INT;
  v_session public.voice_receptionist_sessions;
  v_today_start TIMESTAMPTZ :=
    (date_trunc('day', NOW() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila');
BEGIN
  IF p_max_daily < 1 OR p_max_concurrent < 1 THEN
    RAISE EXCEPTION 'invalid_voice_session_limit' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_property_id::TEXT, 0));
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_property_id::TEXT || ':' || p_guest_user_id::TEXT, 0)
  );

  UPDATE public.voice_receptionist_sessions
  SET
    status = 'expired',
    ended_at = COALESCE(ended_at, NOW()),
    end_reason = COALESCE(end_reason, 'stale_reaper'),
    failure_code = COALESCE(failure_code, 'connecting_lease_expired')
  WHERE property_id = p_property_id
    AND status IN ('reserved', 'connecting')
    AND last_activity_at < NOW() - INTERVAL '2 minutes';

  SELECT COUNT(*) INTO v_daily_count
  FROM public.voice_receptionist_sessions
  WHERE property_id = p_property_id
    AND guest_user_id = p_guest_user_id
    AND reserved_at >= v_today_start
    AND status IN ('active', 'ending', 'ended', 'abandoned');

  IF v_daily_count >= p_max_daily THEN
    RAISE EXCEPTION 'voice_guest_daily_cap' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_concurrent_count
  FROM public.voice_receptionist_sessions
  WHERE property_id = p_property_id
    AND status IN ('reserved', 'connecting', 'active', 'ending');

  IF v_concurrent_count >= p_max_concurrent THEN
    RAISE EXCEPTION 'voice_concurrent_cap' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.voice_receptionist_sessions (
    property_id,
    guest_user_id,
    conversation_id,
    status,
    reserved_at,
    last_activity_at,
    provider_model,
    protocol_version
  )
  VALUES (
    p_property_id,
    p_guest_user_id,
    p_conversation_id,
    'connecting',
    NOW(),
    NOW(),
    p_provider_model,
    p_protocol_version
  )
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_voice_receptionist_session(
  UUID, UUID, UUID, INT, INT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_voice_receptionist_session(
  UUID, UUID, UUID, INT, INT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.end_voice_receptionist_session(
  p_session_id UUID,
  p_guest_user_id UUID,
  p_end_reason TEXT,
  p_failure_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  transitioned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.voice_receptionist_sessions;
  v_ended_at TIMESTAMPTZ := NOW();
  v_duration INT;
BEGIN
  SELECT * INTO v_session
  FROM public.voice_receptionist_sessions
  WHERE id = p_session_id AND guest_user_id = p_guest_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_session.status IN ('ended', 'failed', 'abandoned', 'expired') THEN
    RETURN QUERY SELECT
      COALESCE(v_session.ended_at, v_ended_at),
      COALESCE(
        v_session.duration_seconds,
        GREATEST(
          0,
          EXTRACT(
            EPOCH FROM (COALESCE(v_session.ended_at, v_ended_at) - v_session.started_at)
          )::INT
        )
      ),
      FALSE;
    RETURN;
  END IF;

  v_duration := GREATEST(
    0,
    EXTRACT(EPOCH FROM (v_ended_at - v_session.started_at))::INT
  );
  UPDATE public.voice_receptionist_sessions
  SET
    status = CASE
      WHEN p_end_reason IN ('error', 'provider_error') THEN 'failed'
      WHEN p_end_reason = 'stale_reaper' AND v_session.status IN ('reserved', 'connecting')
        THEN 'failed'
      WHEN p_end_reason = 'stale_reaper' THEN 'abandoned'
      ELSE 'ended'
    END,
    ended_at = v_ended_at,
    duration_seconds = v_duration,
    end_reason = p_end_reason,
    failure_code = p_failure_code,
    last_activity_at = v_ended_at
  WHERE id = p_session_id;

  RETURN QUERY SELECT v_ended_at, v_duration, TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.end_voice_receptionist_session(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_voice_receptionist_session(UUID, UUID, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.sync_voice_receptionist_reaper_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr TEXT := '* * * * *';
  v_cmd_body TEXT := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/voice-receptionist-reaper',
  headers := (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM vault.decrypted_secrets
        WHERE name = 'voice_receptionist_reaper_secret'
      )
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'
        ),
        'X-Voice-Receptionist-Reaper-Secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'voice_receptionist_reaper_secret'
        )
      )
      ELSE jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'
        )
      )
    END
  ),
  body := '{}'::jsonb
);
$BODY$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pg_cron extension not installed');
  END IF;

  FOR r IN
    SELECT jobname FROM cron.job WHERE jobname = 'voice-receptionist-reaper-every-minute'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('voice-receptionist-reaper-every-minute', cron_expr, v_cmd_body);
  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_voice_receptionist_reaper_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.sync_voice_receptionist_reaper_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_voice_receptionist_reaper_cron_job() TO service_role;

SELECT public.sync_voice_receptionist_reaper_cron_job();

-- Consolidated into ai_platform_global_settings and ai_platform_property_settings.feature_configs.
DROP TABLE IF EXISTS public.voice_receptionist_settings;
DROP TABLE IF EXISTS public.voice_receptionist_global_settings;
