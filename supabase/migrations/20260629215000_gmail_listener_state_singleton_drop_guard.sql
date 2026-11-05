-- Guard migration for restore-then-upgrade of the legacy production DB
-- (cutover plan §2.4 / docs/workflow/planned/legacy-prod-to-mt-prod-cutover.md).
--
-- R1 rehearsal failure (2026-10-24, database with real legacy data):
--   20260629220000_gmail_listener_state_per_property.sql updates
--   gmail_listener_state.id from 'default' to property_id::text while the
--   legacy CHECK gmail_listener_state_singleton (id = 'default') is still
--   attached, so the UPDATE violates it on the real singleton row.
--
-- On fresh develop databases the UPDATE in 29220000 no-ops, so dropping the
-- constraint early here is harmless there too. Dated 20260629215000 so it
-- sorts immediately before the migration it unblocks.
ALTER TABLE public.gmail_listener_state
  DROP CONSTRAINT IF EXISTS gmail_listener_state_singleton;
