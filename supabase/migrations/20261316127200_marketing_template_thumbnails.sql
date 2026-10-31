-- Saved marketing template thumbnails move out of design_json into Storage.
--
-- `marketing-templates` strips `design_json.thumbnailDataUrl` on save, uploads the image to
-- the public `property-media` bucket under `{propertyId}/marketing-thumbs/`, and stores the
-- object path here. Rows saved before this keep their embedded thumbnail until the list
-- endpoint migrates them (a few rows per request) or they are saved again.

ALTER TABLE public.marketing_templates
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;

COMMENT ON COLUMN public.marketing_templates.thumbnail_path IS
  'property-media object path of the saved thumbnail ({propertyId}/marketing-thumbs/...). Replaces design_json.thumbnailDataUrl.';

-- A write that only touches the thumbnail (moving an embedded image to Storage, or storing
-- a refreshed one) is not an edit: keep updated_at so items keep their place in "recently
-- edited" order and cache keys stay valid. Any other change stamps NOW(), like
-- update_updated_at_column().
CREATE OR REPLACE FUNCTION public.marketing_templates_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (to_jsonb(NEW) - 'updated_at' - 'thumbnail_path' - 'design_json')
       IS NOT DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'thumbnail_path' - 'design_json')
     AND (NEW.design_json - 'thumbnailDataUrl') IS NOT DISTINCT FROM (OLD.design_json - 'thumbnailDataUrl')
  THEN
    NEW.updated_at = OLD.updated_at;
  ELSE
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_marketing_templates_updated_at ON public.marketing_templates;
CREATE TRIGGER update_marketing_templates_updated_at
  BEFORE UPDATE ON public.marketing_templates
  FOR EACH ROW EXECUTE FUNCTION public.marketing_templates_touch_updated_at();
