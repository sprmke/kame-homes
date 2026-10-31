-- Per-parking guest chat Telegram alerts (same row shape as property-scoped chat settings).

ALTER TABLE public.telegram_chat_settings
  ADD COLUMN IF NOT EXISTS parking_id UUID REFERENCES public.parkings (id) ON DELETE CASCADE;

ALTER TABLE public.telegram_chat_settings
  ALTER COLUMN property_id DROP NOT NULL;

DELETE FROM public.telegram_chat_settings
WHERE property_id IS NULL AND parking_id IS NULL;

ALTER TABLE public.telegram_chat_settings
  DROP CONSTRAINT IF EXISTS telegram_chat_settings_asset_scope_check;

ALTER TABLE public.telegram_chat_settings
  ADD CONSTRAINT telegram_chat_settings_asset_scope_check CHECK (
    ((property_id IS NOT NULL)::int + (parking_id IS NOT NULL)::int) = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS telegram_chat_settings_parking_id_unique
  ON public.telegram_chat_settings (parking_id)
  WHERE parking_id IS NOT NULL;

COMMENT ON COLUMN public.telegram_chat_settings.parking_id IS
  'Parking-scoped guest chat Telegram alerts. Mutually exclusive with property_id.';
