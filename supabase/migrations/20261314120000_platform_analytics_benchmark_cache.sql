-- Host Analytics Phase 5 follow-up — cache table for the "vs Kame median" platform benchmark.
-- Self-review finding (2026-09-09, second pass): computePlatformBenchmark was scanning up to 120
-- other properties live on every full-tier analytics-summary request. This table lets the
-- expensive peer scan run at most once per BENCHMARK_CACHE_TTL_HOURS (see
-- _shared/analyticsService.ts) instead of once per request — every request within the TTL window
-- reads this single cached row instead of re-scanning.
--
-- Single global row (id = 'global') for now — platform-wide, not segmented by region/type, same
-- scope the live computation already had. RLS on, service-role only (edge-gated), same convention
-- as every other table in this module.

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_analytics_benchmark_cache (
  id TEXT PRIMARY KEY,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sample_size INTEGER NOT NULL DEFAULT 0,
  occupancy_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  adr_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  median_occupancy_rate NUMERIC,
  median_adr NUMERIC
);

COMMENT ON TABLE public.platform_analytics_benchmark_cache IS
  'Cached peer occupancy/ADR values for the Host Analytics "vs Kame median" benchmark. Refreshed lazily by computePlatformBenchmark when the cached row is older than BENCHMARK_CACHE_TTL_HOURS. Single global row (id = ''global'').';

ALTER TABLE public.platform_analytics_benchmark_cache ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.platform_analytics_benchmark_cache TO service_role;

COMMIT;
