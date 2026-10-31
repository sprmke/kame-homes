-- Per-property guest voucher award animation (SD form / guest-review).

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS voucher_reveal_style TEXT NOT NULL DEFAULT 'reel';

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_voucher_reveal_style_check;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_voucher_reveal_style_check
  CHECK (voucher_reveal_style IN ('reel', 'wheel', 'flip'));

COMMENT ON COLUMN public.app_settings.voucher_reveal_style IS
  'Guest voucher award animation: reel (slot scroll), wheel (spin), flip (card).';
