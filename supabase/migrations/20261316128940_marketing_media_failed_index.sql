-- Marketing media library: partial index so the sweeper can find old `failed` rows cheaply.
CREATE INDEX IF NOT EXISTS marketing_media_assets_failed_created_idx
  ON public.marketing_media_assets (created_at)
  WHERE status = 'failed';
