-- Marketing Studio "Generate" tab (Phase 2, video) — plan entitlement.
-- Plan:   docs/workflow/in-progress/marketing-ai-asset-generation.md (§5, §7)
-- Matrix: docs/architecture/plans-feature-matrix.md
--
-- `aiMarketingVideoGeneration` — prompt + reference photos in, a finished AI video
-- out (generate-marketing-media, video branch; Veo 3.1). Business+ only — an 8s/720p
-- clip is 800 credits, ~18x an image, so it sits a tier above `aiMarketingImageGeneration`
-- (growth+). RBAC gets its own leaf (`marketing.generate.video:add`) rather than reusing
-- `marketing.generate:add`, so an owner can allow cheap images without allowing an
-- assistant to spend 800 credits a click.

UPDATE public.pricing_plans
SET features = features || '{ "aiMarketingVideoGeneration": false }'::jsonb
WHERE code IN ('free', 'starter', 'commission', 'growth');

UPDATE public.pricing_plans
SET features = features || '{ "aiMarketingVideoGeneration": true }'::jsonb
WHERE code IN ('pro', 'managed', 'business_plus');
