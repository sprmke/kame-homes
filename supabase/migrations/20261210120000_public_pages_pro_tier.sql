-- Public Pages (module + Page Editor + Stay Guide + Showcase) move to the Pro plan.
-- Plan: docs/workflow/in-progress/stay-guide-showcase-templates.md (Phase 5.20)
-- Matrix: docs/architecture/plans-feature-matrix.md
--
-- "Pro" = plan card labelled Pro = internal code `growth` (see 20261029120000).
-- customPages + publicPagesAutosave were Starter+ (20261106130000); now Pro+ only.
-- propertyShowcase is already Pro+ (20261209120100) — left untouched.
-- `commission` tracked with the Starter-equivalent tier, so it loses access too.

UPDATE public.pricing_plans
SET features = features || '{
    "customPages": false,
    "publicPagesAutosave": false
  }'::jsonb
WHERE code IN ('free', 'starter', 'commission');

UPDATE public.pricing_plans
SET features = features || '{
    "customPages": true,
    "publicPagesAutosave": true
  }'::jsonb
WHERE code IN ('growth', 'pro', 'managed');
