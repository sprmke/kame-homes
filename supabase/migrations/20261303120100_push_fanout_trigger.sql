-- Web Push (PWA) — fan a new notification out to push endpoints.
-- Plan: docs/workflow/in-progress/pwa-installable-offline-push.md (Phase 3)
--
-- AFTER INSERT ON public.notifications → pg_net POST → `push-fanout` edge function.
-- Fully decoupled + non-fatal: any failure here MUST NOT block the notification
-- insert (which itself runs inside latency-sensitive booking transitions /
-- webhook acks). Mirrors the calendar-sync cron's Vault + graceful-degrade shape
-- (20261213120500_calendar_sync_cron.sql).
--
-- Requires: pg_net extension + Vault secrets `project_url`, `anon_key`,
-- `push_fanout_secret`. On any environment missing those (fresh local reset),
-- the trigger is a silent no-op.

CREATE OR REPLACE FUNCTION public.notify_push_fanout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault, pg_temp
AS $fn$
DECLARE
  v_project_url text;
  v_anon_key text;
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_anon_key   FROM vault.decrypted_secrets WHERE name = 'anon_key';
  SELECT decrypted_secret INTO v_secret     FROM vault.decrypted_secrets WHERE name = 'push_fanout_secret';

  IF v_project_url IS NULL OR v_anon_key IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_project_url || '/functions/v1/push-fanout',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'X-Push-Fanout-Secret', v_secret
    ),
    body := jsonb_build_object('notificationId', NEW.id)
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never let a push-fanout hiccup roll back the notification insert.
    RAISE WARNING 'notify_push_fanout failed: %', sqlerrm;
    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.notify_push_fanout() IS
  'AFTER INSERT trigger on notifications: pg_net POST to the push-fanout edge function. '
  'SECURITY DEFINER; non-fatal; no-op when pg_net / Vault secrets are absent.';

REVOKE ALL ON FUNCTION public.notify_push_fanout() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_notifications_push_fanout ON public.notifications;
CREATE TRIGGER trg_notifications_push_fanout
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_fanout();
