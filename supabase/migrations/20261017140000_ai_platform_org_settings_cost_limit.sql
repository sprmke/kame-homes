-- ai_platform_hardening (20260814130000) added daily_cost_usd_limit to
-- ai_platform_global_settings and ai_platform_property_settings, but not to
-- ai_platform_org_settings — even though aiUsageService.ts reads/writes it
-- there. This left GET/PATCH on ai-platform-settings (org endpoint) broken.

ALTER TABLE public.ai_platform_org_settings
  ADD COLUMN IF NOT EXISTS daily_cost_usd_limit NUMERIC(12, 6);

COMMENT ON COLUMN public.ai_platform_org_settings.daily_cost_usd_limit IS
  'Org-level daily estimated-cost USD cap override. NULL = inherit from ai_platform_global_settings.default_daily_cost_usd_limit.';
