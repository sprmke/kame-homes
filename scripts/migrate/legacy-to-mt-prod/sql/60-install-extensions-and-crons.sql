-- 60-install-extensions-and-crons.sql — bring a hosted target up to the cron
-- surface the develop migration chain expects.
--
-- Why this file exists: every cron migration is written to no-op when pg_cron is
-- missing, so a target that never enabled the extension ends up with zero
-- scheduled jobs even though all migrations are marked applied. Run this once on
-- any hosted project after the chain is applied (fwor today, mt-prod on a future
-- split).
--
-- Idempotent. Re-running rebuilds every job through its sync_* function.
--
-- Safe to run before cutover: the outbound jobs are parked at the end so the new
-- stack cannot email guests or post Telegram summaries while legacy is still
-- live. Run 61-activate-all-crons.sql at T0 to turn them on.
--
-- Ops reference: docs/archive/operations/scheduled-jobs-and-testing.md
-- Plan: docs/workflow/in-progress/kamespace-02-legacy-prod-to-mt-prod-cutover.md
--       Phase 1.3 + §5.6

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Rebuild every scheduled job through its own sync function. Each function is
-- SECURITY DEFINER, idempotent, and resolves URL/secrets from Vault at build time.
do $$
declare
  fn text;
  fns text[] := array[
    'sync_activity_log_retention_cron_job',
    'sync_analytics_ai_review_cron_job',
    'sync_calendar_sync_cron_job',
    'sync_contract_expiry_cron_job',
    'sync_dashboard_assistant_expire_cron_job',
    'sync_marketing_ai_sessions_purge_cron_job',
    'sync_marketing_generation_cron_job',
    'sync_marketing_media_sweeper_cron_job',
    'sync_marketing_templates_purge_cron_job',
    'sync_meta_inbox_webhook_healthcheck_cron_job',
    'sync_parking_broadcast_expire_cron_job',
    'sync_parking_reminder_cron_job',
    'sync_platform_billing_cron_job',
    'sync_property_page_views_prune_cron_job',
    'sync_query_cache_sweep_cron_job',
    'sync_review_lifecycle_cron_job',
    'sync_sd_refund_cron_job',
    'sync_smart_pricing_cron_job',
    'sync_superhost_assessment_cron_job',
    'sync_telegram_admin_hourly_cron_job',
    'sync_telegram_maintenance_hourly_cron_job',
    'sync_voice_receptionist_canary_cron_job',
    'sync_voice_receptionist_reaper_cron_job'
  ];
begin
  foreach fn in array fns loop
    -- Functions arrive with the migrations; skip any that a target has not
    -- reached yet instead of failing the whole run.
    if exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
    ) then
      execute format('select public.%I()', fn);
    end if;
  end loop;
end $$;

-- Finance takes a slot argument (retained for API compatibility, schedule is fixed hourly).
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sync_telegram_finance_daily_cron_job'
  ) then
    perform public.sync_telegram_finance_daily_cron_job('{}'::jsonb);
  end if;
end $$;

-- Superseded by the two property-dispatch jobs; also creates those.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ensure_telegram_multi_property_cron_dispatch'
  ) then
    perform public.ensure_telegram_multi_property_cron_dispatch();
  end if;
end $$;

-- Scheduled directly in 20261316123050_ai_llm_hardening.sql (no sync function).
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'ai-data-retention-nightly') then
    perform cron.schedule('ai-data-retention-nightly', '41 3 * * *', 'SELECT public.run_ai_data_retention();');
  end if;
end $$;

-- Park pre-cutover outbound work. These are the jobs that can email guests, post
-- Telegram summaries, bill, or change pricing. They stay defined (same schedule,
-- same command) and are switched on by 61-activate-all-crons.sql at T0.
do $$
declare
  held text[] := array[
    'telegram-admin-hourly',
    'telegram-finance-hourly',
    'telegram-maintenance-hourly',
    'telegram-marketing-property-dispatch',
    'telegram-staff-property-dispatch',
    'review-lifecycle-hourly',
    'sd-refund-cron-every-5m-managed',
    'parking-reminder-daily',
    'platform-billing-daily',
    'superhost-assessment-quarterly-manila',
    'analytics-ai-review-weekly-manila',
    'smart-pricing-autopilot-nightly',
    'contract-expiry-daily-manila'
  ];
  r record;
begin
  for r in select jobid from cron.job where jobname = any(held) loop
    perform cron.alter_job(r.jobid, active => false);
  end loop;
end $$;

select jobname, schedule, active from cron.job order by active desc, jobname;
