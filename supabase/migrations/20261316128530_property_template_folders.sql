-- Host-managed folders for custom property templates.
-- Built-in templates stay in their fixed Stay guide / Guest emails sections and are
-- never assigned a folder; only custom templates carry `folder_id`.

CREATE TABLE IF NOT EXISTS public.property_template_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT property_template_folders_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS property_template_folders_property_id_idx
  ON public.property_template_folders (property_id, position, created_at);

-- One folder name per property, case-insensitive, so the rail never shows two
-- identically named folders.
CREATE UNIQUE INDEX IF NOT EXISTS property_template_folders_property_name_unique
  ON public.property_template_folders (property_id, lower(btrim(name)));

ALTER TABLE public.property_template_folders ENABLE ROW LEVEL SECURITY;

-- Access is enforced in the edge functions (templates.custom:* leaves), as with
-- property_template_contents; see 20260905110000_property_template_contents_grants.sql.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_template_folders TO service_role;

-- Deleting a folder keeps its templates; they fall back to the ungrouped section.
ALTER TABLE public.property_template_contents
  ADD COLUMN IF NOT EXISTS folder_id UUID
  REFERENCES public.property_template_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS property_template_contents_folder_id_idx
  ON public.property_template_contents (folder_id);

COMMENT ON TABLE public.property_template_folders IS
  'Host-created folders used to group custom property templates in the Templates workbench.';

COMMENT ON COLUMN public.property_template_contents.folder_id IS
  'Optional folder for custom templates; NULL means the ungrouped Custom section. Always NULL for built-ins.';
