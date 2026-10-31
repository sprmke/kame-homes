CREATE OR REPLACE FUNCTION public.is_voice_receptionist_mint_failure_rate_high(
  p_days INT DEFAULT 7
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    100.0 * COUNT(*) FILTER (WHERE failure_code = 'token_mint_failed') /
    NULLIF(COUNT(*), 0) >= 3,
    FALSE
  )
  FROM public.voice_receptionist_start_attempts
  WHERE created_at >= NOW() - (LEAST(GREATEST(p_days, 1), 30) || ' days')::INTERVAL;
$$;

REVOKE ALL ON FUNCTION public.is_voice_receptionist_mint_failure_rate_high(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_voice_receptionist_mint_failure_rate_high(INT)
  TO service_role;
