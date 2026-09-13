-- Marketing Studio "Generate" tab (Phase 1, images) — plan entitlement + AI allowance.
-- Plan:   docs/workflow/planned/marketing-ai-asset-generation.md (§5, §7)
-- Matrix: docs/architecture/plans-feature-matrix.md
--
-- `aiMarketingImageGeneration` — prompt + reference photos in, a finished image out
-- (generate-marketing-media, image branch). Distinct from the existing
-- `aiMarketingGeneration`, which gates captions and template design tokens and is
-- deliberately left untouched. Pro (`growth`) and above — same gate shape as
-- `smartPricing`. Video generation gets its own key in Phase 2.

UPDATE public.pricing_plans
SET features = features || '{ "aiMarketingImageGeneration": false }'::jsonb
WHERE code IN ('free', 'starter', 'commission');

UPDATE public.pricing_plans
SET features = features || '{ "aiMarketingImageGeneration": true }'::jsonb
WHERE code IN ('growth', 'pro', 'managed', 'business_plus');

-- ─── aiMonthlyCreditAllowance — headroom for generated media ────────────────
--
-- Image generation is 34-45 credits per image at the Draft/Standard tiers, against
-- allowances sized when every AI feature was text-only (a caption costs ~1 credit).
-- Without this bump Pro's 1,000 credits is ~22 images a month shared with Inbox,
-- the Dashboard Assistant and receipt validation, which reads as broken.
--
-- At credit_unit_usd = 0.001 these allowances are also the hard ceiling on Google
-- spend per org per month (the wallet gate makes overrun impossible without a paid
-- top-up): Pro $5, Business $25, Portfolio $50, Managed $60. Deliberate product
-- decision, sized for Phase 2 video (a Veo 3.1 Fast 8s/720p clip is 800 credits).
-- Revisit against real burn data before Phase 3.

UPDATE public.pricing_plans
SET features = features || '{ "aiMonthlyCreditAllowance": 5000 }'::jsonb
WHERE code = 'growth';

UPDATE public.pricing_plans
SET features = features || '{ "aiMonthlyCreditAllowance": 25000 }'::jsonb
WHERE code = 'pro';

UPDATE public.pricing_plans
SET features = features || '{ "aiMonthlyCreditAllowance": 60000 }'::jsonb
WHERE code = 'managed';

-- Portfolio bundle (up to 10 properties) scaled by the same 2.5x as Business.
UPDATE public.pricing_plans
SET features = features || '{ "aiMonthlyCreditAllowance": 50000 }'::jsonb
WHERE code = 'business_plus';
