-- Channel sync outbound export: opt-in only (Share with Airbnb off until the host enables it).
-- Prior DEFAULT true auto-enabled every listing on first Channel sync open.

ALTER TABLE public.property_calendar_export
  ALTER COLUMN is_enabled SET DEFAULT false;

UPDATE public.property_calendar_export
SET is_enabled = false
WHERE is_enabled = true;

COMMENT ON COLUMN public.property_calendar_export.is_enabled IS
  'Host must turn on Share with Airbnb; default false (opt-in).';
