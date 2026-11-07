-- Telegram delivery control + sent-message archive.
--
-- Control: one row per property or parking. Absence of a row means enabled, so
-- existing assets keep delivering without a backfill.
--
-- Log: one row per send attempt, read only through the `telegram-message-log`
-- edge function with a 15-day window. Never stores bot tokens or chat ids.

CREATE TABLE IF NOT EXISTS public.telegram_delivery_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE,
  parking_id UUID REFERENCES public.parkings (id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT telegram_delivery_control_scope_check CHECK (
    (property_id IS NOT NULL AND parking_id IS NULL)
    OR (property_id IS NULL AND parking_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS telegram_delivery_control_property_unique
  ON public.telegram_delivery_control (property_id)
  WHERE property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_delivery_control_parking_unique
  ON public.telegram_delivery_control (parking_id)
  WHERE parking_id IS NOT NULL;

COMMENT ON TABLE public.telegram_delivery_control IS
  'Master Telegram kill switch per property/parking. No row = delivery enabled.';

CREATE TABLE IF NOT EXISTS public.telegram_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE,
  parking_id UUID REFERENCES public.parkings (id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  message_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT telegram_message_log_scope_check CHECK (
    property_id IS NOT NULL OR parking_id IS NOT NULL
  ),
  CONSTRAINT telegram_message_log_status_check CHECK (status IN ('sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_telegram_message_log_property_created
  ON public.telegram_message_log (property_id, created_at DESC)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_message_log_parking_created
  ON public.telegram_message_log (parking_id, created_at DESC)
  WHERE parking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_message_log_created
  ON public.telegram_message_log (created_at);

COMMENT ON TABLE public.telegram_message_log IS
  'Read-only archive of Telegram sends. 15-day read window; pruned by telegram_message_log_prune().';

-- Retention: deletes only rows past the window, so it is safe to call often.
CREATE OR REPLACE FUNCTION public.telegram_message_log_prune(p_retain_days INTEGER DEFAULT 15)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed INTEGER;
BEGIN
  DELETE FROM public.telegram_message_log
  WHERE created_at < NOW() - make_interval(days => GREATEST(p_retain_days, 1));
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

ALTER TABLE public.telegram_delivery_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_message_log ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.telegram_delivery_control TO service_role;
GRANT ALL ON public.telegram_message_log TO service_role;

REVOKE ALL ON FUNCTION public.telegram_message_log_prune(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telegram_message_log_prune(INTEGER) TO service_role;

-- Daily retention job. Pure SQL, so it needs no edge function or secret.
CREATE OR REPLACE FUNCTION public.sync_telegram_message_log_prune_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr TEXT := '15 3 * * *'; -- 11:15 Asia/Manila
BEGIN
  FOR r IN
    SELECT jobname FROM cron.job
    WHERE jobname IN ('telegram-message-log-prune', 'telegram-message-log-prune-managed')
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('telegram-message-log-prune-managed', cron_expr, 'SELECT public.telegram_message_log_prune();');

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'sync_telegram_message_log_prune_job failed: ' || sqlerrm);
END;
$fn$;

COMMENT ON FUNCTION public.sync_telegram_message_log_prune_job() IS
  'Schedules the daily Telegram message log prune. Safe to call repeatedly.';

REVOKE ALL ON FUNCTION public.sync_telegram_message_log_prune_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_telegram_message_log_prune_job() TO service_role;

SELECT public.sync_telegram_message_log_prune_job();
