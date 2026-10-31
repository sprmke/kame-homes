-- Unique property display name within each organization (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS properties_organization_name_lower_unique
  ON public.properties (organization_id, lower(btrim(name)));

COMMENT ON INDEX public.properties_organization_name_lower_unique IS
  'Property names must be unique per organization (case-insensitive, trimmed).';
