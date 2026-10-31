-- Track when Meta Graph backfill has fully completed (vs initial page only).

ALTER TABLE public.social_channel_connections
  ADD COLUMN IF NOT EXISTS meta_backfill_done BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.social_channel_connections.meta_backfill_done IS
  'True when all Messenger/Instagram Graph conversation pages have been synced.';
