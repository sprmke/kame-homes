-- Reference: parking broadcast TTL sweep (Parking E2E Phase 1c).
-- TTL is 15 min (same-day check-in, Asia/Manila) or 1 hr (advance) — run every 5 min
-- so no request sits stale for more than one cadence past its TTL.

-- Option A — no PARKING_BROADCAST_EXPIRE_CRON_SECRET (anon Bearer only):
/*
select cron.schedule(
  'parking-broadcast-expire-every-5m',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/expire-parking-broadcasts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Option B — PARKING_BROADCAST_EXPIRE_CRON_SECRET set (recommended in production):
/*
select cron.schedule(
  'parking-broadcast-expire-every-5m',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/expire-parking-broadcasts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'X-Parking-Broadcast-Expire-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'parking_broadcast_expire_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Local dev (docker network, no Vault — see scheduled-jobs-and-testing.md §11.2):
/*
select cron.schedule(
  'local-parking-broadcast-expire-every-5m',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'http://kong:8000/functions/v1/expire-parking-broadcasts',
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

-- Unschedule: select cron.unschedule('parking-broadcast-expire-every-5m');
-- Unschedule (local): select cron.unschedule('local-parking-broadcast-expire-every-5m');
