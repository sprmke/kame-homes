-- Globally unique organization display names (case-insensitive, trimmed).

CREATE UNIQUE INDEX IF NOT EXISTS organizations_name_lower_unique
  ON public.organizations (LOWER(TRIM(name)));
