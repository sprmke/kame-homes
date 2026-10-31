-- Parking-scoped Guest Inbox quick replies + automation settings.
-- Property/org keep the existing org-wide rows (parking_id IS NULL); parking
-- gets its own row(s) per parking so property and parking wording never mix.

ALTER TABLE public.social_reply_templates
  ADD COLUMN IF NOT EXISTS parking_id UUID REFERENCES public.parkings (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_social_reply_templates_parking
  ON public.social_reply_templates (parking_id, sort_order ASC)
  WHERE parking_id IS NOT NULL;

ALTER TABLE public.social_inbox_settings
  DROP CONSTRAINT IF EXISTS social_inbox_settings_pkey;

ALTER TABLE public.social_inbox_settings
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS parking_id UUID REFERENCES public.parkings (id) ON DELETE CASCADE;

UPDATE public.social_inbox_settings SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.social_inbox_settings
  ALTER COLUMN id SET NOT NULL,
  ADD PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS social_inbox_settings_org_default_unique
  ON public.social_inbox_settings (organization_id)
  WHERE parking_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS social_inbox_settings_org_parking_unique
  ON public.social_inbox_settings (organization_id, parking_id)
  WHERE parking_id IS NOT NULL;

COMMENT ON COLUMN public.social_reply_templates.parking_id IS
  'Set for parking-scoped quick replies; NULL rows are org-wide (used by property).';
COMMENT ON COLUMN public.social_inbox_settings.parking_id IS
  'Set for a parking-specific automation settings row; NULL row is the org default (used by property).';
