-- Per-property payment provider (bank / e-wallet) for guest payment instructions.
-- Existing gcash_* columns remain the storage for account name, number, and QR image.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS payment_provider TEXT;

UPDATE app_settings
SET payment_provider = 'GCash'
WHERE payment_provider IS NULL OR trim(payment_provider) = '';

ALTER TABLE app_settings
  ALTER COLUMN payment_provider SET DEFAULT 'GCash';

COMMENT ON COLUMN app_settings.payment_provider IS
  'Bank or e-wallet shown on guest form + check-in email (e.g. GCash, Maya, BDO). Account details stay in gcash_name / gcash_number / gcash_qr_image_url.';
