-- Reference: quarterly Superhost assessment (Jan 1, Apr 1, Jul 1, Oct 1 — Asia/Manila).
-- Midnight Manila = 16:00 UTC previous calendar day → `0 16 L * 1,4,7,10 *` is fragile;
-- prefer daily trigger + in-function assessment-day guard (see superhostAssessment.ts).
--
-- Optional Edge secret: SUPERHOST_ASSESSMENT_CRON_SECRET — when set, POST must send
--   X-Superhost-Assessment-Cron-Secret: <same value> (Vault: superhost_assessment_cron_secret).

-- Option A — no SUPERHOST_ASSESSMENT_CRON_SECRET (anon Bearer only):
/*
select cron.schedule(
  'superhost-assessment-quarterly-manila',
  '0 16 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/superhost-assessment-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Option B — SUPERHOST_ASSESSMENT_CRON_SECRET set:
/*
select cron.schedule(
  'superhost-assessment-quarterly-manila',
  '0 16 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/superhost-assessment-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'X-Superhost-Assessment-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'superhost_assessment_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Unschedule: select cron.unschedule('superhost-assessment-quarterly-manila');
