-- Reference: daily contract-expiry cron (Unit handoff Phase B).
-- Manila ~09:00 → 01:00 UTC → `0 1 * * *`
--
-- Optional Edge secret: CONTRACT_EXPIRY_CRON_SECRET — when set, POST must send
--   X-Contract-Expiry-Cron-Secret: <same value> (Vault: contract_expiry_cron_secret).

-- Option A — no CONTRACT_EXPIRY_CRON_SECRET (anon Bearer only):
/*
select cron.schedule(
  'contract-expiry-daily-manila',
  '0 1 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/contract-expiry-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Option B — CONTRACT_EXPIRY_CRON_SECRET set:
/*
select cron.schedule(
  'contract-expiry-daily-manila',
  '0 1 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/contract-expiry-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'X-Contract-Expiry-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'contract_expiry_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Unschedule: select cron.unschedule('contract-expiry-daily-manila');
