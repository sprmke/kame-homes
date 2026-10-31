-- Production-readiness doc 23 (rate limiting) — close the remaining exit-gate rows:
-- enforce the authenticated-wrapper default limit (with a super-admin kill switch back
-- to log-only), and give super admins visibility + a manual block for a runaway actor.
--
-- Enforcement default OFF on this migration: existing behavior (log-only) does not
-- change until a super admin flips `authenticated_rate_limit_enforce` on from
-- `/admin/platform-settings`. This mirrors `maintenance_mode` / `signups_enabled` —
-- an operational switch, not a code deploy, controls the blast radius.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS authenticated_rate_limit_enforce BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS authenticated_rate_limit_per_min INT NOT NULL DEFAULT 300
    CHECK (authenticated_rate_limit_per_min > 0);

COMMENT ON COLUMN public.platform_settings.authenticated_rate_limit_enforce IS
  'Kill switch for doc-23 wrapper enforcement: off = log-only (console.warn), on = real 429. Flip off instantly if the default limit misfires on real traffic.';
COMMENT ON COLUMN public.platform_settings.authenticated_rate_limit_per_min IS
  'Requests per 60s per authenticated user on serveAdmin/serveAuthenticated before a 429, when enforcement is on. Default 300/60s: 2.5x the original 120/60s log-only default, since no measured hosted-traffic baseline exists yet (doc 00 gap) — biased loose on purpose to avoid false positives on bulk-editing hosts or multi-tab polling.';

-- Manual block list: a super admin can immediately cut off a specific identity
-- (authenticated user id or `ip:<addr>` from `identityFromRequest`) regardless of
-- the rolling-window count, for an actively-abusive actor while investigating.
CREATE TABLE IF NOT EXISTS public.rate_limit_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

COMMENT ON TABLE public.rate_limit_blocks IS
  'Manual super-admin block list keyed by the same identity string as request_rate_limits (u:<uuid> or ip:<addr>). Checked before the rolling-window count on authenticated wrappers. NULL expires_at = indefinite, cleared explicitly.';

CREATE INDEX IF NOT EXISTS idx_rate_limit_blocks_identity ON public.rate_limit_blocks (identity);

ALTER TABLE public.rate_limit_blocks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.rate_limit_blocks TO service_role;
-- No RLS read policy: service-role only via the super-admin-rate-limits edge function.

-- Aggregation used by the super-admin visibility panel: which identities are
-- currently near/over the wrapper default limit, without scanning the raw
-- fixed-window counter table from the client. Service-role only, same posture
-- as `request_rate_limits` itself.
CREATE OR REPLACE FUNCTION public.list_active_wrapper_rate_limits(
  p_since TIMESTAMPTZ,
  p_min_count INT DEFAULT 1
)
RETURNS TABLE (
  scope TEXT,
  identity TEXT,
  window_start TIMESTAMPTZ,
  count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT scope, identity, window_start, count
  FROM public.request_rate_limits
  WHERE scope LIKE 'wrapper-default:%'
    AND window_start >= p_since
    AND count >= p_min_count
  ORDER BY count DESC, window_start DESC
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.list_active_wrapper_rate_limits(TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_active_wrapper_rate_limits(TIMESTAMPTZ, INT) TO service_role;
