-- Marketing Studio "Generate" tab — reusable reference image/video library.
-- Plan: docs/workflow/planned/marketing-ai-asset-generation.md (§2)
--
-- A library rather than per-job blobs: uploading the property hero shot once and
-- reusing it across many prompts is the core UX of this kind of tool. Files live in
-- the public `property-media` bucket under `marketing-ai-refs/{propertyId}/`.

CREATE TABLE IF NOT EXISTS public.marketing_generation_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,

  media_type TEXT NOT NULL,
  CONSTRAINT marketing_generation_references_media_type_check
    CHECK (media_type IN ('image', 'video')),

  storage_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_name TEXT,
  byte_size BIGINT NOT NULL,
  width INT,
  height INT,
  duration_seconds NUMERIC(6, 2),

  uploaded_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.marketing_generation_references IS
  'Reusable reference assets uploaded for AI marketing generation, scoped to one property.';
COMMENT ON COLUMN public.marketing_generation_references.storage_path IS
  'property-media path: marketing-ai-refs/{propertyId}/{uuid}{ext}. Unique so a row always owns exactly one object.';
COMMENT ON COLUMN public.marketing_generation_references.last_used_at IS
  'Bumped whenever a generation job cites this reference. Drives the 90-day prune.';

CREATE INDEX IF NOT EXISTS idx_marketing_generation_references_property_created
  ON public.marketing_generation_references (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_generation_references_prune
  ON public.marketing_generation_references (COALESCE(last_used_at, created_at));

DROP TRIGGER IF EXISTS update_marketing_generation_references_updated_at
  ON public.marketing_generation_references;
CREATE TRIGGER update_marketing_generation_references_updated_at
  BEFORE UPDATE ON public.marketing_generation_references
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.marketing_generation_references ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.marketing_generation_references TO service_role;
