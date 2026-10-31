-- Org-level master switches for automated emails and Telegram alerts.

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS automation_toggles JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.org_settings.automation_toggles IS
  'Organization master switches for booking workflow emails. Missing keys default to enabled. Telegram is per property.';
