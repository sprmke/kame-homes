-- Close two launch-blocking security gaps found by the pre-production audit.
--
-- The snapshot contains guest PII and is no longer needed after the booking-flow
-- migration completed. CREATE TABLE AS did not inherit RLS or grants.
DROP TABLE IF EXISTS public.guest_submissions_backup_20260501;

-- SECURITY DEFINER functions are executable by PUBLIC unless explicitly revoked.
-- Only trusted server code may adjust an organization's AI credit balance.
REVOKE ALL ON FUNCTION public.adjust_ai_platform_org_credit_wallet(UUID, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_ai_platform_org_credit_wallet(UUID, NUMERIC)
  TO service_role;

REVOKE ALL ON FUNCTION public.increment_ai_platform_usage_daily(
  UUID, DATE, INT, BIGINT, BIGINT, NUMERIC, NUMERIC
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_platform_usage_daily(
  UUID, DATE, INT, BIGINT, BIGINT, NUMERIC, NUMERIC
) TO service_role;

REVOKE ALL ON FUNCTION public.increment_ai_platform_property_usage_daily(
  UUID, UUID, DATE, INT, BIGINT, BIGINT, NUMERIC, NUMERIC
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_platform_property_usage_daily(
  UUID, UUID, DATE, INT, BIGINT, BIGINT, NUMERIC, NUMERIC
) TO service_role;
