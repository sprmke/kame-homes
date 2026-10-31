-- Feature availability controls (docs/workflow/done/feature-availability-controls.md).
-- Super admins turn a page/section/modal/button/background capability off for every
-- host, with a reason. No row for a key = available (fail-open), mirrors
-- platform_settings / kill-switch conventions already used in this repo.

CREATE TABLE IF NOT EXISTS public.feature_availability_overrides (
  feature_key TEXT PRIMARY KEY CHECK (feature_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT CHECK (reason IN ('maintenance','provider_issue','coming_soon','under_review','paused','other')),
  message TEXT CHECK (message IS NULL OR char_length(message) <= 280),
  expected_back_at TIMESTAMPTZ,
  auto_restore BOOLEAN NOT NULL DEFAULT FALSE,
  show_banner BOOLEAN NOT NULL DEFAULT FALSE,
  super_admin_bypass BOOLEAN NOT NULL DEFAULT TRUE,
  disabled_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_availability_reason_when_off CHECK (is_enabled OR reason IS NOT NULL),
  CONSTRAINT feature_availability_other_needs_message CHECK (reason IS DISTINCT FROM 'other' OR message IS NOT NULL),
  CONSTRAINT feature_availability_auto_restore_needs_time CHECK (NOT auto_restore OR expected_back_at IS NOT NULL)
);

COMMENT ON TABLE public.feature_availability_overrides IS
  'Super-admin manual on/off switch per catalog key (see _shared/featureAvailabilityCatalog.ts). Row kept on re-enable so the admin list shows last-changed history; catalog is code, this table only stores overrides. No RLS policies: service-role only via feature-availability / get-feature-availability edge functions.';
COMMENT ON COLUMN public.feature_availability_overrides.feature_key IS
  'Dot-path catalog key, e.g. inbox.meta.reply. Validated against the catalog by the feature-availability edge function; an unknown key with a lingering row is surfaced as Unused in super admin.';
COMMENT ON COLUMN public.feature_availability_overrides.auto_restore IS
  'When true and expected_back_at has passed, the resolver treats the feature as available again at read time — no cron needed.';
COMMENT ON COLUMN public.feature_availability_overrides.super_admin_bypass IS
  'When true, a super admin viewing the surface still sees it as available (background jobs never bypass).';

CREATE TRIGGER feature_availability_overrides_updated_at
  BEFORE UPDATE ON public.feature_availability_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.feature_availability_overrides ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.feature_availability_overrides TO service_role;
-- No RLS policies: access is edge-function only (feature-availability, get-feature-availability).
