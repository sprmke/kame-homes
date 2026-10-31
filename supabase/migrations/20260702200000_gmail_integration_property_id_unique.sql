-- PostgREST upsert ON CONFLICT (property_id) requires a non-partial unique constraint.
-- The partial index from multi_tenancy_foundation (WHERE property_id IS NOT NULL) causes 42P10.

DROP INDEX IF EXISTS public.gmail_mail_integration_property_id_unique;

ALTER TABLE public.gmail_mail_integration
  DROP CONSTRAINT IF EXISTS gmail_mail_integration_property_id_key;

ALTER TABLE public.gmail_mail_integration
  ADD CONSTRAINT gmail_mail_integration_property_id_key UNIQUE (property_id);
