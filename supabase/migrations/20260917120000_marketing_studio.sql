-- Marketing Content Studio: property-scoped design templates + Meta publication log.

CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  platform TEXT,
  aspect_preset TEXT,
  design_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_templates_content_type_check CHECK (
    content_type IN ('calendar', 'design', 'video')
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_templates_property_id
  ON public.marketing_templates (property_id);

CREATE INDEX IF NOT EXISTS idx_marketing_templates_org_id
  ON public.marketing_templates (organization_id);

CREATE TABLE IF NOT EXISTS public.marketing_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.social_channel_connections (id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  publish_type TEXT NOT NULL,
  media_url TEXT NOT NULL,
  caption TEXT,
  meta_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_publications_publish_type_check CHECK (
    publish_type IN ('post', 'story', 'reel')
  ),
  CONSTRAINT marketing_publications_status_check CHECK (
    status IN ('pending', 'published', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_publications_property_created
  ON public.marketing_publications (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_publications_org_status
  ON public.marketing_publications (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_marketing_publications_connection_id
  ON public.marketing_publications (connection_id);

DROP TRIGGER IF EXISTS update_marketing_templates_updated_at ON public.marketing_templates;
CREATE TRIGGER update_marketing_templates_updated_at
  BEFORE UPDATE ON public.marketing_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_publications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_publications TO service_role;

COMMENT ON TABLE public.marketing_templates IS
  'Property-scoped marketing design templates for Content Studio (calendar, design, video).';

COMMENT ON TABLE public.marketing_publications IS
  'Audit log of Meta publish attempts from Content Studio (Facebook posts, Instagram posts/stories).';
