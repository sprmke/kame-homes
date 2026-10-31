-- Persist Meta Graph pagination for on-demand inbox backfill (scroll / search).

ALTER TABLE public.social_channel_connections
  ADD COLUMN IF NOT EXISTS meta_backfill_phase TEXT,
  ADD COLUMN IF NOT EXISTS meta_backfill_next_url TEXT;

ALTER TABLE public.social_channel_connections
  DROP CONSTRAINT IF EXISTS social_channel_connections_meta_backfill_phase_check;

ALTER TABLE public.social_channel_connections
  ADD CONSTRAINT social_channel_connections_meta_backfill_phase_check CHECK (
    meta_backfill_phase IS NULL OR meta_backfill_phase IN ('messenger', 'instagram')
  );

COMMENT ON COLUMN public.social_channel_connections.meta_backfill_phase IS
  'Active Meta inbox backfill phase; NULL when fully synced.';
COMMENT ON COLUMN public.social_channel_connections.meta_backfill_next_url IS
  'Graph API pagination URL for the current backfill phase.';
