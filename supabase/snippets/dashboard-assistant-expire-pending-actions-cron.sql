-- Reference: AI dashboard assistant Tier-2 pending-action TTL sweep.
-- Actions expire 15 min after proposal — run every 5 min so nothing sits stale for more than
-- one cadence past its TTL. See docs/workflow/planned/ai-dashboard-assistant.md §4.

-- Option A — no DASHBOARD_ASSISTANT_EXPIRE_CRON_SECRET (anon Bearer only):
/*
select cron.schedule(
  'dashboard-assistant-expire-pending-actions-every-5m',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/dashboard-assistant-expire-pending-actions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Option B — DASHBOARD_ASSISTANT_EXPIRE_CRON_SECRET set (recommended in production):
/*
select cron.schedule(
  'dashboard-assistant-expire-pending-actions-every-5m',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/dashboard-assistant-expire-pending-actions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'X-Dashboard-Assistant-Expire-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_assistant_expire_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Local dev (docker network, no Vault — see scheduled-jobs-and-testing.md §11.2):
/*
select cron.schedule(
  'local-dashboard-assistant-expire-pending-actions-every-5m',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'http://kong:8000/functions/v1/dashboard-assistant-expire-pending-actions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<LOCAL_ANON_KEY>',
      'Authorization', 'Bearer <LOCAL_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Unschedule: select cron.unschedule('dashboard-assistant-expire-pending-actions-every-5m');
-- Unschedule (local): select cron.unschedule('local-dashboard-assistant-expire-pending-actions-every-5m');
