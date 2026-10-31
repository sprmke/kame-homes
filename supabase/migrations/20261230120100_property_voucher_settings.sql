-- Per-property next-stay voucher configuration (SD form / guest-review).
-- Empty voucher_prizes = use platform defaults in `_shared/voucher.ts`.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS vouchers_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS voucher_prizes JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.app_settings.vouchers_enabled IS
  'When false, skip next-stay voucher after guest review (SD form / guest-review).';

COMMENT ON COLUMN public.app_settings.voucher_prizes IS
  'Host-configured voucher prizes [{code, amount, weight}]. Empty array = platform defaults.';
