-- Host Analytics Phase 2b — minimal first-party public-page pageview log.
-- Plan: docs/workflow/in-progress/host-analytics-module.md (Phase 2b)
--
-- No visit/pageview tracking exists anywhere in the app today. This is deliberately minimal —
-- view count, session-based unique-visitor approximation, referrer/UTM, device class — not a
-- full impressions->CTR funnel. High-volume append-only; queried on-read the same way as the
-- rest of the analytics module (grouped count over a range), no rollup table.

BEGIN;

CREATE TABLE IF NOT EXISTS public.property_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id TEXT NOT NULL,
  referrer_host TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device_class TEXT NOT NULL DEFAULT 'desktop',
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT property_page_views_device_class_check CHECK (
    device_class IN ('mobile', 'tablet', 'desktop')
  )
);

CREATE INDEX IF NOT EXISTS idx_property_page_views_property_viewed
  ON public.property_page_views (property_id, viewed_at DESC);

COMMENT ON TABLE public.property_page_views IS
  'Minimal first-party pageview log for public property pages. No PII — session_id is client-generated (localStorage), no raw user agent stored. Not indexed for per-row analytical use beyond the property+date range scan; expected to be pruned after ~180 days by a follow-up cron (not yet built).';

ALTER TABLE public.property_page_views ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.property_page_views TO service_role;

COMMIT;
