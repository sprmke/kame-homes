-- Clarify voucher_prizes JSON shape: percent-off prizes (not peso amount/weight).

COMMENT ON COLUMN public.app_settings.voucher_prizes IS
  'Host-configured next-stay prizes [{code, percentOff, chancePercent}]. Empty array = platform % defaults. Legacy amount/weight rows are ignored.';
