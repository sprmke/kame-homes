-- Drop guest-review / voucher CTA platform picker (Kame guest reviews replace external review links).

ALTER TABLE public.org_settings
  DROP CONSTRAINT IF EXISTS org_settings_main_social_platform_check;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_main_social_platform_check;

ALTER TABLE public.org_settings
  DROP COLUMN IF EXISTS main_social_platform;

ALTER TABLE public.app_settings
  DROP COLUMN IF EXISTS main_social_platform;
