-- AI Credit Limits — Phase 3 of the AI usage metering plan
-- (docs/workflow/done/ai-usage-metering-credits-foundation.md).
--
-- Adds a credit-based quota layered on top of the existing call/cost quotas, and wires the
-- Phase 1 org credit wallet into enforcement. The default limits below are set high enough
-- that no org can hit them without first exceeding the existing $10/day cost cap: at the
-- Phase 1 working default credit_unit_usd = 0.001, $10/day ~= 10,000 credits/day and a
-- worst-case $300/mo (30 days at the daily cap) ~= 300,000 credits/mo. The defaults here
-- (100,000/day, 1,000,000/mo) sit ~10x above that, so this enforcement path is inert under
-- today's real usage patterns until a pricing owner confirms real numbers and tightens these
-- settings — no further schema/code change needed to do that (see plan doc Open Decisions).

ALTER TABLE public.ai_platform_global_settings
  ADD COLUMN IF NOT EXISTS default_daily_credit_limit NUMERIC(12, 3) NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS default_monthly_credit_limit NUMERIC(12, 3) NOT NULL DEFAULT 1000000;

COMMENT ON COLUMN public.ai_platform_global_settings.default_daily_credit_limit IS
  'Default daily credit cap for orgs with no override. Working default only — deliberately set high (see migration header) so this gate is inert until pricing confirms real numbers.';
COMMENT ON COLUMN public.ai_platform_global_settings.default_monthly_credit_limit IS
  'Default monthly credit cap for orgs with no override. Working default only — see default_daily_credit_limit comment.';

ALTER TABLE public.ai_platform_org_settings
  ADD COLUMN IF NOT EXISTS daily_credit_limit NUMERIC(12, 3),
  ADD COLUMN IF NOT EXISTS monthly_credit_limit NUMERIC(12, 3);

COMMENT ON COLUMN public.ai_platform_org_settings.daily_credit_limit IS
  'Org-level daily credit cap override. NULL = inherit ai_platform_global_settings.default_daily_credit_limit.';
COMMENT ON COLUMN public.ai_platform_org_settings.monthly_credit_limit IS
  'Org-level monthly credit allowance override. NULL = inherit ai_platform_global_settings.default_monthly_credit_limit. Once exceeded, calls draw from ai_platform_org_credit_wallet instead of being blocked (if the wallet has a positive balance).';

ALTER TABLE public.ai_platform_property_settings
  ADD COLUMN IF NOT EXISTS daily_credit_limit NUMERIC(12, 3),
  ADD COLUMN IF NOT EXISTS monthly_credit_limit NUMERIC(12, 3);

COMMENT ON COLUMN public.ai_platform_property_settings.daily_credit_limit IS
  'Per-property daily credit cap override. NULL = inherit from organization settings.';
COMMENT ON COLUMN public.ai_platform_property_settings.monthly_credit_limit IS
  'Per-property monthly credit cap override. NULL = inherit from organization settings.';
