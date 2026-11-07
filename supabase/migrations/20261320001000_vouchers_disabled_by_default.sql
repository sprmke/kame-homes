-- Next-stay vouchers are opt-in. New app_settings rows start disabled.
-- Existing rows keep their stored value so hosts who already configured
-- vouchers are not turned off by this migration.

ALTER TABLE public.app_settings
  ALTER COLUMN vouchers_enabled SET DEFAULT false;

COMMENT ON COLUMN public.app_settings.vouchers_enabled IS
  'When true, offer a next-stay voucher after the guest review (SD form / guest-review). Default false; hosts opt in.';
