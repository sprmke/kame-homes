-- Web Push (PWA) — per-device push subscriptions.
-- Plan: docs/workflow/in-progress/pwa-installable-offline-push.md (Phase 3)
--
-- One row per browser/device push endpoint. Written by the `push-subscribe` /
-- `push-unsubscribe` edge functions (service_role); read by `push-fanout`.
-- `failure_count` is bumped on transient send errors; `disabled_at` retires a
-- subscription after repeated failures or a 404/410 from the push service.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  failure_count INTEGER NOT NULL DEFAULT 0,
  disabled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id)
  WHERE disabled_at IS NULL;

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push endpoints per user/device. Managed by push-subscribe / push-unsubscribe edge functions; consumed by push-fanout.';

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner may read + delete their own device rows (a future "your devices" UI);
-- all writes in practice go through edge functions with the service role.
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Explicit grants — RLS-enabled tables without grants fail with "permission denied"
-- for service_role (see 20261015120000_notifications.sql precedent).
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;
