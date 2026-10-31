-- Custom Pages module (v1): one row per property per page type, selecting a rendering template.
-- Rows are lazily created on first read (see _shared/customPages.ts) — no backfill needed.

CREATE TABLE IF NOT EXISTS public.custom_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  page_type TEXT NOT NULL CHECK (page_type IN ('stay_guide')),
  template_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT custom_pages_property_page_type_unique UNIQUE (property_id, page_type)
);

CREATE INDEX IF NOT EXISTS custom_pages_property_id_idx
  ON public.custom_pages (property_id);

ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_pages TO service_role;

COMMENT ON TABLE public.custom_pages IS
  'Per-property template selection for Custom Pages (v1: stay_guide only). Rows are lazily created on first read.';
