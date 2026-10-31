-- Optional hero/side image per standard template (guest stay guide sections).

ALTER TABLE public.property_template_contents
  ADD COLUMN IF NOT EXISTS section_image_url TEXT;

COMMENT ON COLUMN public.property_template_contents.section_image_url IS
  'Optional public image URL for stay-guide section layout (standard templates only).';
