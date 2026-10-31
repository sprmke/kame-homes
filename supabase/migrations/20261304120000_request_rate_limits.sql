-- Durable, cross-isolate rate limiting for public + lightly-authenticated write endpoints.
-- Plan: docs/workflow/for-testing/captcha-anti-spam-hardening.md (Phase 1, Layer 3)
--
-- Replaces the best-effort in-memory counter in `_shared/publicRateLimit.ts`
-- (per-isolate, resets on cold start) with a shared fixed-window counter.
-- One row per (scope, identity, window_start); `bump_rate_limit()` does the
-- atomic insert-or-increment and returns the new count so the edge helper
-- (`_shared/rateLimit.ts`) can compare it against the limit in a single call.
--
-- Conventions mirror `request_idempotency` / `settings_verification_challenges`:
-- service-role only, RLS enabled with no policies, swept opportunistically by
-- the edge helper (no cron).

CREATE TABLE IF NOT EXISTS public.request_rate_limits (
  scope TEXT NOT NULL,
  identity TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, identity, window_start)
);

-- Backs the opportunistic TTL sweep (`DELETE ... WHERE window_start < cutoff`).
CREATE INDEX IF NOT EXISTS idx_request_rate_limits_window_start
  ON public.request_rate_limits (window_start);

COMMENT ON TABLE public.request_rate_limits IS
  'Fixed-window request counters for anti-spam rate limiting. Rows are disposable; swept when older than ~1 day.';

ALTER TABLE public.request_rate_limits ENABLE ROW LEVEL SECURITY;
-- Service role only — never touched directly by clients.
GRANT ALL ON public.request_rate_limits TO service_role;

-- Atomic insert-or-increment. Returns the new count for this window.
CREATE OR REPLACE FUNCTION public.bump_rate_limit(
  p_scope TEXT,
  p_identity TEXT,
  p_window_start TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.request_rate_limits (scope, identity, window_start, count)
  VALUES (p_scope, p_identity, p_window_start, 1)
  ON CONFLICT (scope, identity, window_start)
  DO UPDATE SET count = public.request_rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_rate_limit(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(TEXT, TEXT, TIMESTAMPTZ) TO service_role;
