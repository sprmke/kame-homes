-- Per-property template content (standard instructions + email body copy + custom templates).

CREATE TABLE IF NOT EXISTS public.property_template_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('standard', 'email', 'custom')),
  name TEXT,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT property_template_contents_property_key_unique UNIQUE (property_id, template_key)
);

CREATE INDEX IF NOT EXISTS property_template_contents_property_id_idx
  ON public.property_template_contents (property_id);

ALTER TABLE public.property_template_contents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_template_contents TO service_role;

COMMENT ON TABLE public.property_template_contents IS
  'Editable HTML content for property standard instructions and email template bodies. Built-in keys use shipped defaults when no row exists.';
