-- Airbnb / OTA two-way calendar sync — Phase 1.
-- Plan: docs/workflow/done/airbnb-calendar-sync.md §5.7 / §17 Q3
-- Matrix: docs/architecture/plans-feature-matrix.md
--
-- `calendarSync` — connect external OTA calendars (Airbnb / Booking.com / VRBO) for two-way
-- availability sync + reservation ingestion. Pro (`growth`) and above; one key covers Phase 1
-- (availability + export feed) and Phase 2 (reservation rows + guest-form completion link).

UPDATE public.pricing_plans
SET features = features || '{ "calendarSync": false }'::jsonb
WHERE code IN ('free', 'starter', 'commission');

UPDATE public.pricing_plans
SET features = features || '{ "calendarSync": true }'::jsonb
WHERE code IN ('growth', 'pro', 'managed', 'business_plus');
