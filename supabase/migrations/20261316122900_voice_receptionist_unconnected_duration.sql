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
  WHERE id = p_session_id
    AND guest_user_id = p_guest_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_session.status IN ('ended', 'failed', 'abandoned', 'expired') THEN
    RETURN QUERY SELECT
      COALESCE(v_session.ended_at, v_ended_at),
      COALESCE(v_session.duration_seconds, 0),
      FALSE;
    RETURN;
  END IF;

  v_duration := CASE
    WHEN v_session.status IN ('reserved', 'connecting') THEN 0
    ELSE GREATEST(0, EXTRACT(EPOCH FROM (v_ended_at - v_session.started_at))::INT)
  END;

  UPDATE public.voice_receptionist_sessions
  SET
    status = CASE
      WHEN p_end_reason IN ('error', 'provider_error') THEN 'failed'
      WHEN p_end_reason = 'stale_reaper'
        AND v_session.status IN ('reserved', 'connecting') THEN 'failed'
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
