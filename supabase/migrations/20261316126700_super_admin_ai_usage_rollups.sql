-- Super-admin AI usage console rollups (super-admin-ai-usage, /admin/ai?tab=usage).
--
-- PostgREST caps every response at max_rows (1000), so reading raw usage events and
-- summing them in the edge function silently undercounts once a range has more than
-- 1000 calls. These functions aggregate in Postgres and return small result sets.
-- Read-only; executable by service_role only.

CREATE INDEX IF NOT EXISTS idx_ai_platform_usage_events_created_brin
  ON public.ai_platform_usage_events USING brin (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_platform_usage_daily_usage_date
  ON public.ai_platform_usage_daily (usage_date);
CREATE INDEX IF NOT EXISTS idx_marketing_generation_jobs_created
  ON public.marketing_generation_jobs (created_at);

-- Platform-wide calls and spend per day.
CREATE OR REPLACE FUNCTION public.super_admin_ai_usage_daily(p_since DATE)
RETURNS TABLE (usage_date DATE, call_count BIGINT, cost_usd NUMERIC)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT d.usage_date, SUM(d.call_count)::BIGINT, COALESCE(SUM(d.estimated_cost_usd), 0)
  FROM public.ai_platform_usage_daily d
  WHERE d.usage_date >= p_since
  GROUP BY d.usage_date
  ORDER BY d.usage_date;
$$;

-- Cost, credits and reliability per AI feature. Errors are counted apart and add no cost.
CREATE OR REPLACE FUNCTION public.super_admin_ai_usage_features(p_since TIMESTAMPTZ)
RETURNS TABLE (
  feature TEXT,
  calls BIGINT,
  errors BIGINT,
  fallbacks BIGINT,
  cache_hits BIGINT,
  cost_usd NUMERIC,
  credits NUMERIC,
  latency_p50_ms INT,
  latency_p95_ms INT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(e.feature, ''), 'other'),
    COUNT(*) FILTER (WHERE e.status IS DISTINCT FROM 'error'),
    COUNT(*) FILTER (WHERE e.status = 'error'),
    COUNT(*) FILTER (WHERE e.status IS DISTINCT FROM 'error' AND e.fallback_used IS TRUE),
    COUNT(*) FILTER (WHERE e.status IS DISTINCT FROM 'error' AND e.cache_hit IS TRUE),
    COALESCE(SUM(e.estimated_cost_usd) FILTER (WHERE e.status IS DISTINCT FROM 'error'), 0),
    COALESCE(SUM(e.credits_consumed) FILTER (WHERE e.status IS DISTINCT FROM 'error'), 0),
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY e.latency_ms)
      FILTER (WHERE e.status IS DISTINCT FROM 'error' AND e.latency_ms > 0))::INT,
    (percentile_disc(0.95) WITHIN GROUP (ORDER BY e.latency_ms)
      FILTER (WHERE e.status IS DISTINCT FROM 'error' AND e.latency_ms > 0))::INT
  FROM public.ai_platform_usage_events e
  WHERE e.created_at >= p_since
  GROUP BY 1;
$$;

-- Top organizations by spend in range, with this month's and today's call counts.
CREATE OR REPLACE FUNCTION public.super_admin_ai_usage_top_orgs(
  p_since TIMESTAMPTZ,
  p_month_start DATE,
  p_today DATE,
  p_limit INT DEFAULT 25
)
RETURNS TABLE (
  organization_id UUID,
  calls BIGINT,
  cost_usd NUMERIC,
  credits NUMERIC,
  month_calls BIGINT,
  today_calls BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH ranged AS (
    SELECT
      e.organization_id,
      COUNT(*) AS calls,
      COALESCE(SUM(e.estimated_cost_usd), 0) AS cost_usd,
      COALESCE(SUM(e.credits_consumed), 0) AS credits
    FROM public.ai_platform_usage_events e
    WHERE e.created_at >= p_since
      AND e.organization_id IS NOT NULL
      AND e.status IS DISTINCT FROM 'error'
    GROUP BY e.organization_id
    ORDER BY cost_usd DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  SELECT
    r.organization_id,
    r.calls,
    r.cost_usd,
    r.credits,
    COALESCE(SUM(d.call_count) FILTER (WHERE d.usage_date >= p_month_start), 0)::BIGINT,
    COALESCE(SUM(d.call_count) FILTER (WHERE d.usage_date = p_today), 0)::BIGINT
  FROM ranged r
  LEFT JOIN public.ai_platform_usage_daily d
    ON d.organization_id = r.organization_id AND d.usage_date >= p_month_start
  GROUP BY r.organization_id, r.calls, r.cost_usd, r.credits
  ORDER BY r.cost_usd DESC;
$$;

-- Usage per plan. An org's plan is its live subscription (a live row wins over a
-- suspended one), else the default plan, matching planEntitlements.getDefaultPricingPlan.
CREATE OR REPLACE FUNCTION public.super_admin_ai_usage_by_plan(
  p_since TIMESTAMPTZ,
  p_month_start DATE
)
RETURNS TABLE (
  plan_id UUID,
  org_count BIGINT,
  active_orgs BIGINT,
  calls BIGINT,
  credits NUMERIC,
  cost_usd NUMERIC,
  month_credits NUMERIC,
  orgs_at_allowance BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH default_plan AS (
    SELECT COALESCE(
      (SELECT p.id FROM public.pricing_plans p WHERE p.is_default AND p.is_active LIMIT 1),
      (SELECT p.id FROM public.pricing_plans p WHERE p.code = 'free' LIMIT 1)
    ) AS id
  ),
  org_plan AS (
    SELECT o.id AS organization_id, COALESCE(s.plan_id, (SELECT id FROM default_plan)) AS plan_id
    FROM public.organizations o
    LEFT JOIN LATERAL (
      SELECT s.plan_id
      FROM public.org_subscriptions s
      WHERE s.organization_id = o.id
        AND s.status IN ('active', 'trialing', 'past_due', 'suspended')
      ORDER BY (s.status = 'suspended'), s.created_at DESC
      LIMIT 1
    ) s ON TRUE
  ),
  ranged AS (
    SELECT
      e.organization_id,
      COUNT(*) AS calls,
      COALESCE(SUM(e.credits_consumed), 0) AS credits,
      COALESCE(SUM(e.estimated_cost_usd), 0) AS cost_usd
    FROM public.ai_platform_usage_events e
    WHERE e.created_at >= p_since
      AND e.organization_id IS NOT NULL
      AND e.status IS DISTINCT FROM 'error'
    GROUP BY e.organization_id
  ),
  month AS (
    SELECT d.organization_id, COALESCE(SUM(d.credits_consumed), 0) AS credits
    FROM public.ai_platform_usage_daily d
    WHERE d.usage_date >= p_month_start
    GROUP BY d.organization_id
  )
  SELECT
    op.plan_id,
    COUNT(*),
    COUNT(r.organization_id),
    COALESCE(SUM(r.calls), 0)::BIGINT,
    COALESCE(SUM(r.credits), 0),
    COALESCE(SUM(r.cost_usd), 0),
    COALESCE(SUM(m.credits), 0),
    COUNT(*) FILTER (
      WHERE COALESCE((p.features ->> 'aiMonthlyCreditAllowance')::NUMERIC, 0) > 0
        AND COALESCE(m.credits, 0) >= (p.features ->> 'aiMonthlyCreditAllowance')::NUMERIC
    )
  FROM org_plan op
  JOIN public.pricing_plans p ON p.id = op.plan_id
  LEFT JOIN ranged r ON r.organization_id = op.organization_id
  LEFT JOIN month m ON m.organization_id = op.organization_id
  GROUP BY op.plan_id;
$$;

-- Marketing Studio job outcomes. Render percentiles are only meaningful on completed
-- rows. Unbilled = completed before p_unbilled_before with credits_consumed still null
-- (the sweeper's own "not billed yet" signal; usage_recorded_at is only a claim).
CREATE OR REPLACE FUNCTION public.super_admin_marketing_generation_rollup(
  p_since TIMESTAMPTZ,
  p_unbilled_before TIMESTAMPTZ
)
RETURNS TABLE (
  media_type TEXT,
  quality_tier TEXT,
  resolution TEXT,
  job_status TEXT,
  error_code TEXT,
  jobs BIGINT,
  credits NUMERIC,
  cost_usd NUMERIC,
  render_p50_seconds INT,
  render_p95_seconds INT,
  unbilled BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    j.media_type,
    j.quality_tier,
    CASE WHEN j.media_type = 'video' THEN j.resolution END,
    j.job_status,
    j.error_code,
    COUNT(*),
    COALESCE(SUM(j.credits_consumed), 0),
    COALESCE(SUM(j.estimated_cost_usd), 0),
    (percentile_disc(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (j.completed_at - j.created_at))
    ) FILTER (WHERE j.completed_at IS NOT NULL))::INT,
    (percentile_disc(0.95) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (j.completed_at - j.created_at))
    ) FILTER (WHERE j.completed_at IS NOT NULL))::INT,
    COUNT(*) FILTER (
      WHERE j.job_status = 'completed'
        AND j.credits_consumed IS NULL
        AND j.completed_at < p_unbilled_before
    )
  FROM public.marketing_generation_jobs j
  WHERE j.created_at >= p_since
  GROUP BY 1, 2, 3, 4, 5;
$$;

REVOKE ALL ON FUNCTION public.super_admin_ai_usage_daily(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_ai_usage_features(TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_ai_usage_top_orgs(TIMESTAMPTZ, DATE, DATE, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_ai_usage_by_plan(TIMESTAMPTZ, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_marketing_generation_rollup(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_ai_usage_daily(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.super_admin_ai_usage_features(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.super_admin_ai_usage_top_orgs(TIMESTAMPTZ, DATE, DATE, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.super_admin_ai_usage_by_plan(TIMESTAMPTZ, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.super_admin_marketing_generation_rollup(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
