-- Property Showcase page type + Growth+ entitlement.
-- Plan: docs/workflow/in-progress/property-showcase-landing-pages.md

-- Widen public_page_configs.page_type CHECK
ALTER TABLE public.public_page_configs
  DROP CONSTRAINT IF EXISTS public_page_configs_page_type_check;

ALTER TABLE public.public_page_configs
  ADD CONSTRAINT public_page_configs_page_type_check
  CHECK (page_type IN ('stay_guide', 'property_landing', 'property_showcase'));

COMMENT ON TABLE public.public_page_configs IS
  'Per-property JSON section configs for stay_guide, property_landing, and property_showcase guest surfaces.';

-- Widen custom_pages.page_type CHECK
ALTER TABLE public.custom_pages
  DROP CONSTRAINT IF EXISTS custom_pages_page_type_check;

ALTER TABLE public.custom_pages
  ADD CONSTRAINT custom_pages_page_type_check
  CHECK (page_type IN ('stay_guide', 'property_showcase'));

COMMENT ON TABLE public.custom_pages IS
  'Per-property template selection for stay_guide and property_showcase (template_key allowlisted in edge).';
