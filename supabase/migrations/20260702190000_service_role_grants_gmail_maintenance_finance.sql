-- Edge functions use supabaseServiceRole() (Postgres role service_role).
-- RLS-enabled tables still need explicit GRANTs; without them PostgREST returns
-- "permission denied for table …" even though service_role bypasses RLS policies.
--
-- Fresh-reset note: maintenance_items is created in 20260818120000. Grant it only
-- when present; catch-up grant is in 20260818120100.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_mail_integration TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_mail_oauth_state TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_line_items TO service_role;

DO $$
BEGIN
  IF to_regclass('public.maintenance_items') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_items TO service_role;
  END IF;
END $$;
