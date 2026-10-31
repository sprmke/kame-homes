-- Per-property Gmail OAuth (Phase 1d): drop singleton id constraint; track property on OAuth state.

ALTER TABLE public.gmail_mail_integration
  DROP CONSTRAINT IF EXISTS gmail_mail_integration_singleton;

ALTER TABLE public.gmail_mail_oauth_state
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE;

-- Align legacy singleton row id with property_id for upsert-by-property lookups.
UPDATE public.gmail_mail_integration
SET id = property_id::text
WHERE id = 'default' AND property_id IS NOT NULL;
