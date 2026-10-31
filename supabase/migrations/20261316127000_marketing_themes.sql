-- Marketing themes: a host-saved look (palette, fonts, background, corners) that every
-- calendar, post, video and AI result in Marketing Studio follows.
--
-- Built-in themes ("Property colors" and the starter looks) live in code and have
-- text keys (`property-colors`, `starter:<id>`); only themes a host creates or edits
-- are rows here. `marketing_templates.theme_key` therefore holds either a built-in key
-- or a `marketing_themes.id`, so it is TEXT with no foreign key. NULL means the item
-- predates themes and is shown under "Property colors". No backfill needed.
--
-- Access control is enforced in the `marketing-themes` edge function
-- (resolveScopedPropertyAccess + marketing.* leaves), same as marketing_templates.

CREATE TABLE IF NOT EXISTS public.marketing_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tokens JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'custom',
  source_ref TEXT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_themes_name_length CHECK (char_length(name) BETWEEN 1 AND 60),
  CONSTRAINT marketing_themes_source_check CHECK (
    source IN ('custom', 'starter', 'photos', 'duplicate', 'ai')
  ),
  CONSTRAINT marketing_themes_tokens_object CHECK (jsonb_typeof(tokens) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_marketing_themes_property_id
  ON public.marketing_themes (property_id, created_at);

DROP TRIGGER IF EXISTS update_marketing_themes_updated_at ON public.marketing_themes;
CREATE TRIGGER update_marketing_themes_updated_at
  BEFORE UPDATE ON public.marketing_themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.marketing_themes ENABLE ROW LEVEL SECURITY;

-- Same posture as marketing_templates: no client policies; the edge function uses the
-- service role after its own permission checks. New tables need explicit privileges here.
GRANT ALL ON public.marketing_themes TO service_role;
REVOKE ALL ON public.marketing_themes FROM anon, authenticated;

ALTER TABLE public.marketing_templates
  ADD COLUMN IF NOT EXISTS theme_key TEXT;

CREATE INDEX IF NOT EXISTS idx_marketing_templates_property_theme
  ON public.marketing_templates (property_id, theme_key);

COMMENT ON COLUMN public.marketing_templates.theme_key IS
  'Theme the item was made in: a built-in key (property-colors, starter:<id>) or a marketing_themes.id. NULL = made before themes (shown under Property colors).';
