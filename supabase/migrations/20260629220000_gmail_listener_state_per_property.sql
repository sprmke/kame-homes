-- Phase 1e: per-property Gmail listener history cursor (one row per property).

ALTER TABLE public.gmail_listener_state
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE;

-- Backfill legacy singleton row to Monaco 2604.
UPDATE public.gmail_listener_state gls
SET property_id = p.id
FROM public.properties p
WHERE gls.id = 'default'
  AND p.slug = 'monaco-2604'
  AND gls.property_id IS NULL;

-- Align primary key id with property_id (matches gmail_mail_integration pattern).
UPDATE public.gmail_listener_state
SET id = property_id::text
WHERE property_id IS NOT NULL
  AND id = 'default';

ALTER TABLE public.gmail_listener_state
  DROP CONSTRAINT IF EXISTS gmail_listener_state_singleton;

CREATE UNIQUE INDEX IF NOT EXISTS gmail_listener_state_property_id_unique
  ON public.gmail_listener_state (property_id)
  WHERE property_id IS NOT NULL;

COMMENT ON COLUMN public.gmail_listener_state.property_id IS
  'Property whose Gmail mailbox this cursor tracks. id mirrors property_id::text.';
