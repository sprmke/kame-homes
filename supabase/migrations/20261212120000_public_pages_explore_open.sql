-- Restore Public Pages explore-open on Free/Starter (and Commission).
-- Reverts the route-blocking half of 20261210120000_public_pages_pro_tier.sql.
--
-- customPages = browse gallery + open Page Editor (every tier again).
-- publicPagesAutosave stays Pro+ — Free/Starter can explore but Save / autosave
-- open the upgrade modal; server PATCH still requires publicPagesAutosave.
--
-- Matrix: docs/architecture/plans-feature-matrix.md
-- Guide: docs/guides/routes/org/property/public-pages.md

UPDATE public.pricing_plans
SET features = jsonb_set(features, '{customPages}', 'true'::jsonb, true)
WHERE code IN ('free', 'starter', 'commission');
