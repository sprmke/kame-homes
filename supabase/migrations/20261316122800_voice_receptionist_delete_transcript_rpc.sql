CREATE OR REPLACE FUNCTION public.delete_voice_receptionist_transcript(
  p_session_id UUID,
  p_guest_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.voice_receptionist_sessions
    WHERE id = p_session_id
      AND guest_user_id = p_guest_user_id
  ) THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.voice_receptionist_transcript_turns
  WHERE session_id = p_session_id;

  UPDATE public.voice_receptionist_sessions
  SET
    transcript_status = 'discarded',
    client_report_hash = NULL,
    safety_flags = '{}',
    transcript_processed_at = NOW()
  WHERE id = p_session_id
    AND guest_user_id = p_guest_user_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_voice_receptionist_transcript(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_voice_receptionist_transcript(UUID, UUID)
  TO service_role;
