-- Public page section configs (visibility / order / light style overrides).
-- Separate from custom_pages (template_key) and property_template_contents (rich-text body).
-- Rows are lazily created on first host read (see _shared/publicPageConfigs.ts).
-- Guest render paths use getPublicPageConfigOrDefault (no write on every page load).

CREATE TABLE IF NOT EXISTS public.public_page_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  page_type TEXT NOT NULL CHECK (page_type IN ('stay_guide', 'property_landing')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT public_page_configs_property_page_type_unique UNIQUE (property_id, page_type)
);

CREATE INDEX IF NOT EXISTS public_page_configs_property_id_idx
  ON public.public_page_configs (property_id);

ALTER TABLE public.public_page_configs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_page_configs TO service_role;

COMMENT ON TABLE public.public_page_configs IS
  'Per-property section visibility/order/style for guest public pages (v1: stay_guide, property_landing). Lazily created on host read.';
