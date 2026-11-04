-- Capacity hardening for the Pro-plan footprint.
-- Plan: docs/workflow/planned/supabase-capacity-and-operational-readiness.md
--
-- Three independent, low-risk wins:
--   1. Drop exact duplicate indexes (advisor `duplicate_index`).
--   2. Make RLS predicates init-plan safe (`auth.uid()` -> `(select auth.uid())`)
--      so a policy is evaluated once per statement instead of once per row.
--   3. Deterministic nightly retention for internal logs and rate-limit
--      counters, which otherwise grow forever (only the edge-side
--      opportunistic sweep covered `request_rate_limits`).
--
-- No product-visible table is pruned here: notifications, activity_log, and
-- guest data keep their existing retention or are left untouched.

-- ---------------------------------------------------------------------------
-- 1. Duplicate indexes
-- ---------------------------------------------------------------------------
-- Both pairs are byte-for-byte identical definitions. Keep the index whose
-- name matches the column the code actually filters on.
DROP INDEX IF EXISTS public.idx_finance_telegram_reminder_log_line_item;
DROP INDEX IF EXISTS public.idx_support_ticket_messages_ticket_created;

-- ---------------------------------------------------------------------------
-- 2. RLS init-plan safety
-- ---------------------------------------------------------------------------
-- Rewrites every policy that calls `auth.uid()` directly. Semantics are
-- identical; only the evaluation strategy changes. Roles, commands, USING and
-- WITH CHECK expressions are preserved exactly (generated from pg_policies).

ALTER POLICY ai_dashboard_assistant_action_plans_select ON public.ai_dashboard_assistant_action_plans TO authenticated USING ((user_id = (select auth.uid())));
ALTER POLICY ai_dashboard_assistant_conversations_select ON public.ai_dashboard_assistant_conversations TO authenticated USING (((user_id = (select auth.uid())) AND user_can_access_ai_dashboard_assistant_org(organization_id)));
ALTER POLICY ai_dashboard_assistant_feedback_select_own ON public.ai_dashboard_assistant_feedback TO authenticated USING ((user_id = (select auth.uid())));
ALTER POLICY ai_dashboard_assistant_messages_select ON public.ai_dashboard_assistant_messages TO authenticated USING ((EXISTS ( SELECT 1
   FROM ai_dashboard_assistant_conversations c
  WHERE ((c.id = ai_dashboard_assistant_messages.conversation_id) AND (c.user_id = (select auth.uid()))))));
ALTER POLICY ai_dashboard_assistant_pending_actions_select ON public.ai_dashboard_assistant_pending_actions TO authenticated USING ((user_id = (select auth.uid())));
ALTER POLICY guest_chat_ai_feedback_select_own ON public.guest_chat_ai_feedback TO authenticated USING ((user_id = (select auth.uid())));
ALTER POLICY guest_profiles_insert_own ON public.guest_profiles TO authenticated WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY guest_profiles_select_own ON public.guest_profiles TO authenticated USING (((select auth.uid()) = user_id));
ALTER POLICY guest_profiles_update_own ON public.guest_profiles TO authenticated USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY guest_requests_select ON public.guest_requests TO authenticated USING (((guest_user_id = (select auth.uid())) OR user_can_access_ai_dashboard_assistant_org(organization_id)));
ALTER POLICY "Guests delete own saved properties" ON public.guest_saved_properties TO authenticated USING (((select auth.uid()) = user_id));
ALTER POLICY "Guests insert own saved properties" ON public.guest_saved_properties TO authenticated WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Guests read own saved properties" ON public.guest_saved_properties TO authenticated USING (((select auth.uid()) = user_id));
ALTER POLICY "Guests update own saved properties" ON public.guest_saved_properties TO authenticated USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY notification_preferences_delete_own ON public.notification_preferences TO authenticated USING ((user_id = (select auth.uid())));
ALTER POLICY notification_preferences_insert_own ON public.notification_preferences TO authenticated WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY notification_preferences_select_own ON public.notification_preferences TO authenticated USING ((user_id = (select auth.uid())));
ALTER POLICY notification_preferences_update_own ON public.notification_preferences TO authenticated USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY notification_reads_insert ON public.notification_reads TO authenticated WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY notification_reads_select ON public.notification_reads TO authenticated USING ((user_id = (select auth.uid())));
ALTER POLICY "Org owner can insert own org_settings" ON public.org_settings TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = org_settings.organization_id) AND (o.owner_id = (select auth.uid()))))));
ALTER POLICY "Org owner can read own org_settings" ON public.org_settings TO authenticated USING ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = org_settings.organization_id) AND (o.owner_id = (select auth.uid()))))));
ALTER POLICY "Org owner can update own org_settings" ON public.org_settings TO authenticated USING ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = org_settings.organization_id) AND (o.owner_id = (select auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = org_settings.organization_id) AND (o.owner_id = (select auth.uid()))))));
ALTER POLICY "Org owner can delete own organizations" ON public.organizations TO authenticated USING ((owner_id = (select auth.uid())));
ALTER POLICY "Org owner can insert own organizations" ON public.organizations TO authenticated WITH CHECK ((owner_id = (select auth.uid())));
ALTER POLICY "Org owner can read own organizations" ON public.organizations TO authenticated USING ((owner_id = (select auth.uid())));
ALTER POLICY "Org owner can update own organizations" ON public.organizations TO authenticated USING ((owner_id = (select auth.uid()))) WITH CHECK ((owner_id = (select auth.uid())));
ALTER POLICY "Org owner can delete properties in own orgs" ON public.properties TO authenticated USING ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = properties.organization_id) AND (o.owner_id = (select auth.uid()))))));
ALTER POLICY "Org owner can insert properties in own orgs" ON public.properties TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = properties.organization_id) AND (o.owner_id = (select auth.uid()))))));
ALTER POLICY "Org owner can read properties in own orgs" ON public.properties TO authenticated USING ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = properties.organization_id) AND (o.owner_id = (select auth.uid()))))));
ALTER POLICY "Org owner can update properties in own orgs" ON public.properties TO authenticated USING ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = properties.organization_id) AND (o.owner_id = (select auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = properties.organization_id) AND (o.owner_id = (select auth.uid()))))));
ALTER POLICY push_subscriptions_delete_own ON public.push_subscriptions TO authenticated USING ((user_id = (select auth.uid())));
ALTER POLICY push_subscriptions_select_own ON public.push_subscriptions TO authenticated USING ((user_id = (select auth.uid())));
ALTER POLICY social_conversations_select ON public.social_conversations TO authenticated USING ((user_can_access_org_inbox(organization_id) OR ((platform = 'web'::text) AND (guest_user_id = (select auth.uid())))));
ALTER POLICY user_ui_preferences_insert_own ON public.user_ui_preferences TO authenticated WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY user_ui_preferences_select_own ON public.user_ui_preferences TO authenticated USING ((user_id = (select auth.uid())));
ALTER POLICY user_ui_preferences_update_own ON public.user_ui_preferences TO authenticated USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 3. Nightly retention for internal, non-product tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_operational_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_started_at TIMESTAMPTZ := clock_timestamp();
  v_rate_limits INTEGER := 0;
  v_processed_emails INTEGER := 0;
  v_telegram_admin INTEGER := 0;
  v_telegram_staff INTEGER := 0;
  v_finance_reminders INTEGER := 0;
  v_maintenance_reminders INTEGER := 0;
  v_webhook_events INTEGER := 0;
BEGIN
  DELETE FROM public.request_rate_limits
  WHERE window_start < now() - interval '2 days';
  GET DIAGNOSTICS v_rate_limits = ROW_COUNT;

  DELETE FROM public.processed_emails
  WHERE processed_at < now() - interval '120 days';
  GET DIAGNOSTICS v_processed_emails = ROW_COUNT;

  DELETE FROM public.telegram_admin_notification_log
  WHERE sent_at < now() - interval '180 days';
  GET DIAGNOSTICS v_telegram_admin = ROW_COUNT;

  DELETE FROM public.telegram_staff_notification_log
  WHERE sent_at < now() - interval '180 days';
  GET DIAGNOSTICS v_telegram_staff = ROW_COUNT;

  DELETE FROM public.finance_telegram_reminder_log
  WHERE sent_at < now() - interval '180 days';
  GET DIAGNOSTICS v_finance_reminders = ROW_COUNT;

  DELETE FROM public.maintenance_telegram_reminder_log
  WHERE sent_at < now() - interval '180 days';
  GET DIAGNOSTICS v_maintenance_reminders = ROW_COUNT;

  DELETE FROM public.social_webhook_events
  WHERE processed_at < now() - interval '30 days';
  GET DIAGNOSTICS v_webhook_events = ROW_COUNT;

  -- Audit log: N/A (platform retention only; no organization, property, or
  -- guest state is touched). The health console still needs a heartbeat.
  INSERT INTO public.system_job_heartbeats AS t (
    job_name, last_started_at, last_finished_at, last_success_at, last_status,
    last_duration_ms, consecutive_failures, total_runs, updated_at
  )
  VALUES (
    'operational-retention', v_started_at, clock_timestamp(), clock_timestamp(), 'ok',
    (EXTRACT(EPOCH FROM (clock_timestamp() - v_started_at)) * 1000)::int, 0, 1, now()
  )
  ON CONFLICT (job_name) DO UPDATE SET
    last_started_at = EXCLUDED.last_started_at,
    last_finished_at = EXCLUDED.last_finished_at,
    last_success_at = EXCLUDED.last_success_at,
    last_status = 'ok',
    last_duration_ms = EXCLUDED.last_duration_ms,
    consecutive_failures = 0,
    total_runs = t.total_runs + 1,
    updated_at = now();

  RETURN jsonb_build_object(
    'request_rate_limits', v_rate_limits,
    'processed_emails', v_processed_emails,
    'telegram_admin_notification_log', v_telegram_admin,
    'telegram_staff_notification_log', v_telegram_staff,
    'finance_telegram_reminder_log', v_finance_reminders,
    'maintenance_telegram_reminder_log', v_maintenance_reminders,
    'social_webhook_events', v_webhook_events
  );
END;
$fn$;

COMMENT ON FUNCTION public.prune_operational_tables() IS
  'Nightly retention for internal logs and rate-limit counters. SECURITY DEFINER; '
  'service_role only. Never touches guest, booking, notification, or activity data.';

REVOKE ALL ON FUNCTION public.prune_operational_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_operational_tables() TO service_role;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'operational-retention-nightly') THEN
      PERFORM cron.unschedule('operational-retention-nightly');
    END IF;
    PERFORM cron.schedule(
      'operational-retention-nightly',
      '23 2 * * *', -- 02:23 UTC = 10:23 Manila, off-peak
      'SELECT public.prune_operational_tables();'
    );
  END IF;
END
$do$;
