-- Web Push (PWA) — also fan out on a coalesced notification UPDATE.
-- Plan: docs/workflow/in-progress/pwa-installable-offline-push.md (Phase 3 review)
--
-- `createOrCoalesceNotification` (inbox chat) UPDATEs the existing row for the
-- 2nd+ message in a thread (bumps `created_at`, refreshes title/body, re-unreads).
-- The in-app realtime channel already fires on INSERT *and* UPDATE, so OS push
-- must too — otherwise a busy thread gives in-app toasts but a silent lock screen
-- after the first message.
--
-- Splits the single AFTER INSERT trigger into INSERT + UPDATE, the UPDATE one
-- guarded to fire only when `created_at` actually moved (the coalesce bump).

DROP TRIGGER IF EXISTS trg_notifications_push_fanout ON public.notifications;
DROP TRIGGER IF EXISTS trg_notifications_push_fanout_ins ON public.notifications;
DROP TRIGGER IF EXISTS trg_notifications_push_fanout_upd ON public.notifications;

CREATE TRIGGER trg_notifications_push_fanout_ins
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_fanout();

CREATE TRIGGER trg_notifications_push_fanout_upd
  AFTER UPDATE ON public.notifications
  FOR EACH ROW
  WHEN (NEW.created_at IS DISTINCT FROM OLD.created_at)
  EXECUTE FUNCTION public.notify_push_fanout();
