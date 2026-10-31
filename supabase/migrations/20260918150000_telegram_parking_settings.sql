-- Dedicated Telegram settings for parking slots (one row per parking_id).

CREATE TABLE IF NOT EXISTS public.telegram_parking_settings (
  parking_id UUID PRIMARY KEY REFERENCES public.parkings (id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  bot_token_encrypted TEXT,
  chat_id_encrypted TEXT,
  reservation_request_template TEXT NOT NULL DEFAULT
    'New parking reservation request for {{slot_label}}.',
  check_in_reminder_template TEXT NOT NULL DEFAULT
    'Parking check-in reminder: {{slot_label}} on {{check_in_date}}.',
  payment_received_template TEXT NOT NULL DEFAULT
    'Payment received for parking {{slot_label}}.',
  notify_on_reservation_request BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_check_in_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_payment_received BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE public.telegram_parking_settings IS
  'Per-parking Telegram bot credentials and notification message templates.';

ALTER TABLE public.telegram_parking_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_parking_settings TO service_role;

-- Copy legacy templates from parking_settings when present.
INSERT INTO public.telegram_parking_settings (
  parking_id,
  reservation_request_template,
  check_in_reminder_template,
  payment_received_template
)
SELECT
  ps.parking_id,
  COALESCE(
    NULLIF(trim(ps.parking_notification_templates ->> 'reservation_request'), ''),
    'New parking reservation request for {{slot_label}}.'
  ),
  COALESCE(
    NULLIF(trim(ps.parking_notification_templates ->> 'check_in_reminder'), ''),
    'Parking check-in reminder: {{slot_label}} on {{check_in_date}}.'
  ),
  COALESCE(
    NULLIF(trim(ps.parking_notification_templates ->> 'payment_received'), ''),
    'Payment received for parking {{slot_label}}.'
  )
FROM public.parking_settings ps
ON CONFLICT (parking_id) DO NOTHING;
